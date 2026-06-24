// Service worker — typed port of v1 background/service_worker.js.
// Behavior parity is the contract (SPEC §7); the only intentional changes
// are the typed message router, streak math delegated to engine/streak,
// and v2 page paths.

import { applyBlockRules, blockPageUrl, clearBlockRules } from '../engine/blocklist'
import {
  buildCommitMessage,
  buildProblemReadme,
  checkDeviceToken,
  ensureRepo,
  fetchUser as ghFetchUser,
  langToExt,
  pushSolution,
  slugFolder,
  startDeviceFlow,
} from '../engine/github'
import {
  fetchAllAcceptedSubmissions,
  fetchCurrentUser,
  fetchDailyChallenge,
  fetchProblemCatalog,
  fetchProblemMeta,
} from '../engine/leetcode-api'
import { getDueProblems, mergeReview, newProblemDefaults } from '../engine/srs'
import {
  DEFAULT_STATE,
  getCatalog,
  getProblems,
  getSettings,
  getState,
  setCatalog,
  setProblem,
  setSettings,
  setState,
  todayISO,
} from '../engine/storage'
import {
  computeDailyResetPatch,
  computeNextResetISO,
  computeStreakAdvance,
  yesterdayISO,
} from '../engine/streak'
import {
  fetchAllProblems,
  fetchDailyState,
  getSession,
  signInWithGoogle,
  signOut,
  fetchSettings as supaFetchSettings,
  upsertSettings as supaUpsertSettings,
  upsertDailyState,
  upsertProblem,
  upsertProblemsBulk,
} from '../engine/supabase'
import type { CatalogItem, Problem, Settings, SolvePayload } from '../engine/types'
import type {
  AuthState,
  GithubConnectResult,
  GithubOauthCheckResult,
  GithubOauthStartResult,
  ImportResult,
  LeetcodeLoginStatus,
  Msg,
  MsgResult,
  MsgType,
  Ok,
  OkOrError,
  OverrideResult,
  SignInResult,
  StatusResponse,
} from '../messages'

interface PendingOauth {
  clientId: string
  deviceCode: string
  interval: number
  expiresAt: number
  lastPollAt: number
}

let pendingOauth: PendingOauth | null = null

const ALARM_DAILY_RESET = 'lce.dailyReset'
const ALARM_OVERRIDE_END = 'lce.overrideEnd'

const ONBOARDING_PATH = 'src/surfaces/onboarding/index.html'

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const settings = await getSettings()
    await setState({
      ...DEFAULT_STATE,
      quotaResetAt: computeNextResetISO(settings.quotaResetHour),
      streakLastUpdated: todayISO(),
    })
    chrome.tabs.create({ url: chrome.runtime.getURL(ONBOARDING_PATH) })
  }
  await scheduleDailyReset()
  await syncBlockRules()
  await reinjectContentScripts()
  // Covers extension reload/update: restore from the cloud if signed in.
  if (await getSession()) await pullFromSupabase()
})

/**
 * Chrome destroys ISOLATED-world content scripts on extension reload/update
 * and never re-injects into already-open tabs. Reloading open LC tabs is the
 * only reliable fix: it clears stale chunk references and lets Chrome inject
 * fresh scripts from the current manifest. Re-injection attempts are blocked
 * by crxjs's "already loaded" guard anyway, so skip straight to reload.
 */
async function reinjectContentScripts(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://leetcode.com/*' })
    if (tabs.length === 0) return
    for (const tab of tabs) {
      if (tab.id == null) continue
      try {
        await chrome.tabs.reload(tab.id)
        console.log('[LCE] reloaded LC tab', tab.id, 'to pick up fresh content scripts')
      } catch (e) {
        console.warn('[LCE] tab reload failed', tab.id, e)
      }
    }
  } catch (e) {
    console.warn('[LCE] reinjectContentScripts failed', e)
  }
}

chrome.runtime.onStartup.addListener(async () => {
  await scheduleDailyReset()
  await syncBlockRules()
  // Refresh from the cloud when a session exists — sign-in is no longer
  // the only moment a pull can happen.
  if (await getSession()) await pullFromSupabase()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_DAILY_RESET) {
    await doDailyReset()
  } else if (alarm.name === ALARM_OVERRIDE_END) {
    await setState({ overrideActiveUntil: null })
    await syncBlockRules()
  }
})

chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return
  await maybeBlockTabNavigation(details.tabId, details.url)
})
chrome.webNavigation.onReferenceFragmentUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return
  await maybeBlockTabNavigation(details.tabId, details.url)
})

async function maybeBlockTabNavigation(tabId: number, url: string): Promise<void> {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return
    if (!(await isBlockActive())) return
    const settings = await getSettings()
    const hostname = u.hostname.replace(/^www\./, '')
    const blocked = (settings.blocklist || []).some((d) => {
      const dom = d.replace(/^www\./, '')
      return hostname === dom || hostname.endsWith(`.${dom}`)
    })
    if (!blocked) return
    await chrome.tabs.update(tabId, { url: blockPageUrl(url) })
  } catch (e) {
    console.warn('[LCE] SPA block check failed', e)
  }
}

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  handleMessage(msg)
    .then(sendResponse)
    .catch((err) => {
      console.error('lce message error', err)
      sendResponse({ error: err instanceof Error ? err.message : String(err) })
    })
  return true
})

function handleMessage(msg: Msg): Promise<MsgResult<MsgType>> {
  switch (msg.type) {
    case 'getStatus':
      return getStatus()
    case 'recordSolve':
      return recordSolve(msg.payload)
    case 'getDueProblems':
      return getDueProblemsList(msg.limit)
    case 'fetchDailyChallenge':
      return safeFetchDaily()
    case 'getRandomUnsolved':
      return getRandomUnsolvedProblem()
    case 'manualEntry':
      return recordSolve(msg.payload)
    case 'getProblemMeta':
      return safeFetchProblemMeta(msg.slug)
    case 'searchCatalog':
      return searchCatalog(msg.query, msg.limit || 8)
    case 'startOverride':
      return startOverride(msg.phrase)
    case 'signInGoogle':
      return signIn()
    case 'signOut':
      return doSignOut()
    case 'getAuthState':
      return getAuthState()
    case 'importLeetcodeHistory':
      return importHistory()
    case 'updateSettings':
      return updateSettings(msg.patch)
    case 'forceSyncAll':
      return forceSyncAll()
    case 'retryLastSync':
      return forceSyncAll()
    case 'markMastered':
      return markMastered(msg.slug)
    case 'unmarkMastered':
      return unmarkMastered(msg.slug)
    case 'resetAll':
      return resetAllData()
    case 'getLeetcodeLoginStatus':
      return getLeetcodeLoginStatus()
    case 'connectGithub':
      return connectGithub(msg.token, msg.repoName)
    case 'disconnectGithub':
      return disconnectGithub()
    case 'testGithub':
      return testGithub()
    case 'githubStartOauth':
      return githubStartOauth(msg.clientId)
    case 'githubCheckOauth':
      return githubCheckOauth(msg.repoName)
    case 'githubCancelOauth':
      return githubCancelOauth()
    default: {
      const unknown: never = msg
      throw new Error(`Unknown message type: ${(unknown as { type: string }).type}`)
    }
  }
}

async function getStatus(): Promise<StatusResponse> {
  const [settings, state, problems, session] = await Promise.all([
    getSettings(),
    getState(),
    getProblems(),
    getSession(),
  ])
  const due = getDueProblems(problems, todayISO(), 5)
  return {
    settings,
    state,
    due,
    blockActive: await isBlockActive(),
    today: todayISO(),
    signedIn: !!session,
    user: session?.user
      ? { email: session.user.email, name: session.user.user_metadata?.full_name }
      : null,
  }
}

async function getAuthState(): Promise<AuthState> {
  const session = await getSession()
  if (!session) return { signedIn: false }
  return {
    signedIn: true,
    email: session.user?.email,
    name: session.user?.user_metadata?.full_name,
    avatar: session.user?.user_metadata?.avatar_url,
  }
}

async function signIn(): Promise<SignInResult> {
  try {
    const session = await signInWithGoogle()
    await pullFromSupabase()
    // Also push any local data that may not exist remotely yet
    try {
      const localProblems = await getProblems()
      if (Object.keys(localProblems).length) await upsertProblemsBulk(localProblems)
      const localSettings = await getSettings()
      await supaUpsertSettings(localSettings)
      await syncDailyStateToSupabase()
    } catch (e) {
      console.warn('[LCE] initial push failed', e)
    }
    await setState({ lastSyncError: null })
    return {
      ok: true,
      email: session.user?.email,
      name: session.user?.user_metadata?.full_name,
    }
  } catch (e) {
    const error = errMessage(e)
    await setState({ lastSyncError: error })
    return { ok: false, error }
  }
}

async function doSignOut(): Promise<Ok> {
  await signOut()
  await setState({ lastSyncError: null })
  return { ok: true }
}

/**
 * Pull remote data into local storage. Each source is fetched
 * independently — one failing table must never block the others
 * (a daily-state 404 used to torpedo the problems restore).
 */
async function pullFromSupabase(): Promise<void> {
  const errors: string[] = []

  try {
    const remoteProblems = await fetchAllProblems()
    if (remoteProblems && Object.keys(remoteProblems).length) {
      // Local wins on conflicts — the local copy is the one being edited.
      const localProblems = await getProblems()
      const merged = { ...remoteProblems, ...localProblems }
      await chrome.storage.local.set({ problems: merged })
    }
  } catch (e) {
    console.warn('[LCE] problems pull failed', e)
    errors.push(`problems: ${errMessage(e)}`)
  }

  try {
    const remoteSettings = await supaFetchSettings()
    if (remoteSettings) {
      const localSettings = await getSettings()
      await setSettings({ ...localSettings, ...remoteSettings })
    }
  } catch (e) {
    console.warn('[LCE] settings pull failed', e)
    errors.push(`settings: ${errMessage(e)}`)
  }

  try {
    const todayRemote = await fetchDailyState(todayISO())
    if (todayRemote) {
      const state = await getState()
      await setState({
        solvesToday: Math.max(state.solvesToday || 0, todayRemote.solves_today || 0),
        reviewsToday: Math.max(state.reviewsToday || 0, todayRemote.reviews_today || 0),
        newSolvesToday: Math.max(state.newSolvesToday || 0, todayRemote.new_solves_today || 0),
        overrideUsedToday: Math.max(
          state.overrideUsedToday || 0,
          todayRemote.override_used_today || 0,
        ),
        streakDays: Math.max(state.streakDays || 0, todayRemote.streak_days || 0),
      })
    }
  } catch (e) {
    console.warn('[LCE] daily state pull failed', e)
    errors.push(`daily state: ${errMessage(e)}`)
  }

  await syncBlockRules()
  await setState({ lastSyncError: errors.length ? errors.join(' · ') : null })
}

async function isBlockActive(): Promise<boolean> {
  const settings = await getSettings()
  const state = await getState()
  if (state.overrideActiveUntil && new Date(state.overrideActiveUntil) > new Date()) return false
  return state.solvesToday < settings.dailyQuota
}

async function syncBlockRules(): Promise<void> {
  const settings = await getSettings()
  const active = await isBlockActive()
  if (active) await applyBlockRules(settings.blocklist, true)
  else await clearBlockRules()
}

async function recordSolve(payload: SolvePayload): Promise<{ ok: true; problem: Problem }> {
  const { slug, number, title, url, difficulty, topics, confidence, notes, needReview, mastered } =
    payload
  const problems = await getProblems()
  const existing = problems[slug]
  const settings = await getSettings()

  let updated: Problem
  if (existing) {
    updated = mergeReview(existing, {
      confidence,
      notes,
      needReview,
      mastered,
      ladder: settings.intervalLadder,
    })
  } else {
    const base = newProblemDefaults({ number, title, url, difficulty, topics })
    updated = mergeReview(base, {
      confidence,
      notes,
      needReview,
      mastered,
      ladder: settings.intervalLadder,
    })
    updated.timesReviewed = 1
  }
  await setProblem(slug, updated)

  const isReview = !!existing
  await bumpQuotaCounter(isReview)
  await maybeAdvanceStreak()
  await syncBlockRules()

  // Cloud syncs are best-effort — local write already committed above.
  void Promise.allSettled([
    syncProblemToSupabase(slug, updated),
    syncDailyStateToSupabase(),
    syncProblemToGithub(updated, payload),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') console.warn('[LCE] cloud sync failed', r.reason)
    }
  })

  return { ok: true, problem: updated }
}

async function bumpQuotaCounter(isReview: boolean): Promise<void> {
  const state = await getState()
  await setState({
    solvesToday: state.solvesToday + 1,
    ...(isReview
      ? { reviewsToday: (state.reviewsToday || 0) + 1 }
      : { newSolvesToday: (state.newSolvesToday || 0) + 1 }),
  })
}

async function maybeAdvanceStreak(): Promise<void> {
  const settings = await getSettings()
  const state = await getState()
  const patch = computeStreakAdvance({
    solvesToday: state.solvesToday,
    dailyQuota: settings.dailyQuota,
    streakDays: state.streakDays,
    streakLastUpdated: state.streakLastUpdated,
    today: todayISO(),
    yesterday: yesterdayISO(),
  })
  if (patch) await setState(patch)
}

async function getDueProblemsList(limit = 10) {
  const problems = await getProblems()
  return getDueProblems(problems, todayISO(), limit)
}

async function safeFetchDaily() {
  try {
    return await fetchDailyChallenge()
  } catch (e) {
    console.warn('daily challenge fetch failed', e)
    return null
  }
}

async function safeFetchProblemMeta(slug: string) {
  try {
    return await fetchProblemMeta(slug)
  } catch (e) {
    return { error: errMessage(e) }
  }
}

async function searchCatalog(query: string, limit: number): Promise<CatalogItem[]> {
  let catalog = await getCatalog()
  if (!catalog.items.length) {
    try {
      const items = await fetchProblemCatalog(2000)
      catalog = { fetchedAt: todayISO(), items }
      await setCatalog(catalog)
    } catch {
      return []
    }
  }
  const q = query.toLowerCase()
  return catalog.items
    .filter((p) => p.title.toLowerCase().includes(q) || String(p.number).includes(q))
    .slice(0, limit)
}

async function getRandomUnsolvedProblem(): Promise<CatalogItem | null> {
  const catalog = await getCatalog()
  const problems = await getProblems()
  if (!catalog.items.length) {
    try {
      const items = await fetchProblemCatalog(2000)
      await setCatalog({ fetchedAt: todayISO(), items })
      catalog.items = items
    } catch (e) {
      console.warn('catalog fetch failed', e)
      return null
    }
  }
  const unsolved = catalog.items.filter((c) => {
    const p = problems[c.slug]
    return p?.status !== 'Mastered'
  })
  if (!unsolved.length) return null
  return unsolved[Math.floor(Math.random() * unsolved.length)] ?? null
}

async function startOverride(phrase: string): Promise<OverrideResult> {
  const settings = await getSettings()
  if (!settings.overrideEnabled) return { ok: false, error: 'Override disabled' }
  if (phrase !== settings.overridePhrase) return { ok: false, error: 'Phrase mismatch' }
  const state = await getState()
  if (state.overrideUsedToday >= settings.overrideCountPerDay) {
    return { ok: false, error: 'No overrides left today' }
  }
  const untilMs = Date.now() + settings.overrideDurationMin * 60 * 1000
  await setState({
    overrideUsedToday: state.overrideUsedToday + 1,
    overrideActiveUntil: new Date(untilMs).toISOString(),
  })
  chrome.alarms.create(ALARM_OVERRIDE_END, { when: untilMs })
  await syncBlockRules()
  await syncDailyStateToSupabase()
  return { ok: true, until: untilMs }
}

async function importHistory(): Promise<ImportResult> {
  try {
    let { leetcodeUsername } = await getSettings()
    if (!leetcodeUsername) {
      const user = await fetchCurrentUser()
      if (!user?.username) throw new Error('Not logged into LeetCode in this browser')
      leetcodeUsername = user.username
      await setSettings({ leetcodeUsername })
    }

    const accepted = await fetchAllAcceptedSubmissions(leetcodeUsername)
    const problems = await getProblems()
    const newOnes: Record<string, Problem> = {}

    for (const s of accepted) {
      if (problems[s.titleSlug]) continue
      let meta = null
      try {
        meta = await fetchProblemMeta(s.titleSlug)
      } catch {}
      const firstSolved = s.timestamp
        ? new Date(Number.parseInt(s.timestamp, 10) * 1000).toISOString().slice(0, 10)
        : todayISO()
      const problem: Problem = {
        number: meta?.number ?? null,
        title: s.title,
        url: `https://leetcode.com/problems/${s.titleSlug}/`,
        difficulty: meta?.difficulty ?? 'Unknown',
        topics: meta?.topics ?? [],
        firstSolved,
        lastReviewed: firstSolved,
        timesReviewed: 1,
        srsIntervalDays: 30,
        status: 'Mastered',
        latestConfidence: null,
        notes: '',
        history: [
          { date: firstSolved, type: 'solve', confidence: null, needReview: false, mastered: true },
        ],
      }
      await setProblem(s.titleSlug, problem)
      newOnes[s.titleSlug] = problem
    }

    if (Object.keys(newOnes).length) {
      try {
        await upsertProblemsBulk(newOnes)
      } catch (e) {
        console.warn('[LCE] supabase bulk import failed', e)
      }
    }
    return { ok: true, imported: Object.keys(newOnes).length }
  } catch (e) {
    const error = errMessage(e)
    await setState({ lastSyncError: error })
    return { ok: false, error }
  }
}

async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = await setSettings(patch)
  await syncBlockRules()
  await scheduleDailyReset()
  try {
    await supaUpsertSettings(next)
  } catch (e) {
    console.warn('[LCE] settings supabase sync failed', e)
  }
  return next
}

async function forceSyncAll(): Promise<OkOrError> {
  try {
    // Bidirectional: pull first (merge remote into local), then push the
    // merged result — so this doubles as a recovery path after a wipe.
    await pullFromSupabase()
    const problems = await getProblems()
    const settings = await getSettings()
    await upsertProblemsBulk(problems)
    await supaUpsertSettings(settings)
    await syncDailyStateToSupabase()
    await setState({ lastSyncError: null })
    await setBadgeOk()
    return { ok: true }
  } catch (e) {
    const error = errMessage(e)
    await setState({ lastSyncError: error })
    return { ok: false, error }
  }
}

async function markMastered(slug: string): Promise<OkOrError> {
  const problems = await getProblems()
  const p = problems[slug]
  if (!p) return { ok: false, error: 'Not found' }
  p.status = 'Mastered'
  await setProblem(slug, p)
  await syncProblemToSupabase(slug, p)
  return { ok: true }
}

async function unmarkMastered(slug: string): Promise<OkOrError> {
  const problems = await getProblems()
  const p = problems[slug]
  if (!p) return { ok: false, error: 'Not found' }
  p.status = 'Active'
  p.srsIntervalDays = 1
  p.lastReviewed = todayISO()
  await setProblem(slug, p)
  await syncProblemToSupabase(slug, p)
  return { ok: true }
}

async function resetAllData(): Promise<Ok> {
  await chrome.storage.local.clear()
  await clearBlockRules()
  return { ok: true }
}

async function syncProblemToSupabase(slug: string, problem: Problem): Promise<void> {
  try {
    await upsertProblem(slug, problem)
    await setState({ lastSyncError: null })
    await setBadgeOk()
  } catch (e) {
    console.error('supabase problem sync failed', e)
    await setState({ lastSyncError: errMessage(e) })
    await setBadgeError()
  }
}

async function syncDailyStateToSupabase(): Promise<void> {
  try {
    const state = await getState()
    await upsertDailyState(todayISO(), state)
    await setState({ lastSyncError: null })
    await setBadgeOk()
  } catch (e) {
    console.warn('daily state supabase sync failed', e)
  }
}

async function setBadgeOk(): Promise<void> {
  const state = await getState()
  if (state.lastSyncError || state.lastGithubError) return
  chrome.action.setBadgeText({ text: '' })
}

async function setBadgeError(): Promise<void> {
  chrome.action.setBadgeText({ text: '!' })
  chrome.action.setBadgeBackgroundColor({ color: '#D9534F' })
}

// ============================================================
// LeetCode + GitHub
// ============================================================

async function getLeetcodeLoginStatus(): Promise<LeetcodeLoginStatus> {
  try {
    const user = await fetchCurrentUser()
    return { ok: true, isSignedIn: !!user?.isSignedIn, username: user?.username || null }
  } catch (e) {
    return { ok: false, isSignedIn: false, error: errMessage(e) }
  }
}

async function connectGithub(token: string, repoName?: string): Promise<GithubConnectResult> {
  try {
    if (!token) throw new Error('Token required')
    const user = await ghFetchUser(token)
    if (!user?.login) throw new Error('Invalid token')
    const settings = await getSettings()
    const repo = repoName || settings.githubRepo || 'leetcode-enforcer-solutions'
    const repoData = await ensureRepo(token, user.login, repo)
    await setSettings({
      githubEnabled: true,
      githubToken: token,
      githubOwner: user.login,
      githubRepo: repo,
      githubBranch: repoData.default_branch || 'main',
      githubRepoUrl: repoData.html_url,
    })
    await setState({ lastGithubError: null })
    return { ok: true, owner: user.login, repo, url: repoData.html_url }
  } catch (e) {
    const error = errMessage(e)
    await setState({ lastGithubError: error })
    return { ok: false, error }
  }
}

async function disconnectGithub(): Promise<Ok> {
  await setSettings({
    githubEnabled: false,
    githubToken: null,
    githubOwner: null,
    githubRepoUrl: null,
  })
  await setState({ lastGithubError: null, lastGithubCommitUrl: null })
  return { ok: true }
}

async function testGithub(): Promise<{ ok: true; login: string } | { ok: false; error: string }> {
  try {
    const { githubToken } = await getSettings()
    if (!githubToken) throw new Error('Not connected')
    const user = await ghFetchUser(githubToken)
    if (!user?.login) throw new Error('Invalid token')
    return { ok: true, login: user.login }
  } catch (e) {
    return { ok: false, error: errMessage(e) }
  }
}

async function githubStartOauth(clientId: string): Promise<GithubOauthStartResult> {
  try {
    if (!clientId) throw new Error('Client ID required')
    const data = await startDeviceFlow(clientId, 'repo')
    pendingOauth = {
      clientId,
      deviceCode: data.device_code,
      interval: data.interval || 5,
      expiresAt: Date.now() + (data.expires_in || 900) * 1000,
      lastPollAt: 0,
    }
    await setSettings({ githubClientId: clientId })
    return {
      ok: true,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      verificationUriComplete:
        data.verification_uri_complete || `${data.verification_uri}?user_code=${data.user_code}`,
      expiresIn: data.expires_in,
    }
  } catch (e) {
    return { ok: false, error: errMessage(e) }
  }
}

async function githubCheckOauth(repoName?: string): Promise<GithubOauthCheckResult> {
  try {
    if (!pendingOauth) return { ok: false, error: 'No OAuth in progress' }
    if (Date.now() > pendingOauth.expiresAt) {
      pendingOauth = null
      return { ok: false, error: 'Device code expired — try again' }
    }
    if (Date.now() - pendingOauth.lastPollAt < pendingOauth.interval * 1000) {
      return { ok: true, pending: true }
    }
    pendingOauth.lastPollAt = Date.now()
    const result = await checkDeviceToken(pendingOauth.clientId, pendingOauth.deviceCode)
    if (result.slowDown) pendingOauth.interval += 5
    if (result.pending) return { ok: true, pending: true }
    if (result.token) {
      pendingOauth = null
      const connectRes = await connectGithub(result.token, repoName)
      if (!connectRes.ok) return connectRes
      return {
        ok: true,
        pending: false,
        owner: connectRes.owner,
        repo: connectRes.repo,
        url: connectRes.url,
      }
    }
    return { ok: false, error: 'Unexpected OAuth response' }
  } catch (e) {
    return { ok: false, error: errMessage(e) }
  }
}

async function githubCancelOauth(): Promise<Ok> {
  pendingOauth = null
  return { ok: true }
}

async function syncProblemToGithub(problem: Problem, payload: SolvePayload): Promise<void> {
  const settings = await getSettings()
  if (!settings.githubEnabled || !settings.githubToken) return
  if (!payload.code || !payload.lang) return
  try {
    const ext = langToExt(payload.lang)
    const folder = slugFolder({ number: problem.number, slug: payload.slug })
    const files = [
      { path: `solution.${ext}`, content: payload.code },
      { path: 'README.md', content: buildProblemReadme(problem) },
    ]
    const message = buildCommitMessage(problem, payload.confidence)
    const result = await pushSolution(settings.githubToken, {
      owner: settings.githubOwner ?? '',
      repo: settings.githubRepo,
      branch: settings.githubBranch,
      folder,
      files,
      message,
    })
    await setState({ lastGithubError: null, lastGithubCommitUrl: result.url })
    await setBadgeOk()
  } catch (e) {
    console.error('github push failed', e)
    await setState({ lastGithubError: errMessage(e) })
    await setBadgeError()
  }
}

// ============================================================
// Daily reset scheduling
// ============================================================

async function scheduleDailyReset(): Promise<void> {
  const settings = await getSettings()
  const next = computeNextResetISO(settings.quotaResetHour)
  chrome.alarms.create(ALARM_DAILY_RESET, {
    when: new Date(next).getTime(),
    periodInMinutes: 24 * 60,
  })
}

async function doDailyReset(): Promise<void> {
  const state = await getState()
  const settings = await getSettings()
  const patch = computeDailyResetPatch({
    streakDays: state.streakDays,
    streakLastUpdated: state.streakLastUpdated,
    yesterday: yesterdayISO(),
    nextResetAt: computeNextResetISO(settings.quotaResetHour),
  })
  await setState(patch)
  await syncBlockRules()
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
