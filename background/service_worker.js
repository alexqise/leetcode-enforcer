import {
  getSettings, setSettings, getState, setState, getProblems, setProblem,
  getCatalog, setCatalog, todayISO, nowISO, DEFAULT_STATE
} from '../lib/storage.js';
import { mergeReview, newProblemDefaults, getDueProblems, isDue } from '../lib/srs.js';
import { applyBlockRules, clearBlockRules } from '../lib/blocklist.js';
import {
  signInWithGoogle, signOut, getCurrentUser, getSession,
  upsertProblem, upsertProblemsBulk, fetchAllProblems,
  upsertSettings as supaUpsertSettings, fetchSettings as supaFetchSettings,
  upsertDailyState, fetchDailyState
} from '../lib/supabase.js';
import {
  fetchCurrentUser, fetchDailyChallenge, fetchAllAcceptedSubmissions,
  fetchProblemMeta, fetchProblemCatalog
} from '../lib/leetcode_api.js';
import { computeStats } from '../lib/stats.js';
import {
  fetchUser as ghFetchUser, ensureRepo, pushSolution, langToExt,
  slugFolder, buildProblemReadme, buildCommitMessage,
  startDeviceFlow, checkDeviceToken
} from '../lib/github.js';

let pendingOauth = null;

const ALARM_DAILY_RESET = 'lce.dailyReset';
const ALARM_OVERRIDE_END = 'lce.overrideEnd';

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const settings = await getSettings();
    await setState({
      ...DEFAULT_STATE,
      quotaResetAt: computeNextResetISO(settings.quotaResetHour),
      streakLastUpdated: todayISO()
    });
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
  await scheduleDailyReset();
  await syncBlockRules();
});

chrome.runtime.onStartup.addListener(async () => {
  await scheduleDailyReset();
  await syncBlockRules();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_DAILY_RESET) {
    await doDailyReset();
  } else if (alarm.name === ALARM_OVERRIDE_END) {
    await setState({ overrideActiveUntil: null });
    await syncBlockRules();
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return;
  await maybeBlockTabNavigation(details.tabId, details.url);
});
chrome.webNavigation.onReferenceFragmentUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return;
  await maybeBlockTabNavigation(details.tabId, details.url);
});

async function maybeBlockTabNavigation(tabId, url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    if (!await isBlockActive()) return;
    const settings = await getSettings();
    const hostname = u.hostname.replace(/^www\./, '');
    const blocked = (settings.blocklist || []).some(d => {
      const dom = d.replace(/^www\./, '');
      return hostname === dom || hostname.endsWith('.' + dom);
    });
    if (!blocked) return;
    const blockUrl = chrome.runtime.getURL('block/block.html') + '?from=' + encodeURIComponent(url);
    await chrome.tabs.update(tabId, { url: blockUrl });
  } catch (e) { console.warn('[LCE] SPA block check failed', e); }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch(err => {
    console.error('lce message error', err);
    sendResponse({ error: err.message || String(err) });
  });
  return true;
});

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case 'getStatus': return getStatus();
    case 'recordSolve': return recordSolve(msg.payload);
    case 'getDueProblems': return getDueProblemsList(msg.limit);
    case 'fetchDailyChallenge': return safeFetchDaily();
    case 'getRandomUnsolved': return getRandomUnsolvedProblem();
    case 'manualEntry': return recordManualEntry(msg.payload);
    case 'getProblemMeta': return safeFetchProblemMeta(msg.slug);
    case 'searchCatalog': return searchCatalog(msg.query, msg.limit || 8);
    case 'startOverride': return startOverride(msg.phrase);
    case 'signInGoogle': return signIn();
    case 'signOut': return doSignOut();
    case 'getAuthState': return getAuthState();
    case 'importLeetcodeHistory': return importHistory();
    case 'updateSettings': return updateSettings(msg.patch);
    case 'forceSyncAll': return forceSyncAll();
    case 'retryLastSync': return retryLastSync();
    case 'markMastered': return markMastered(msg.slug);
    case 'unmarkMastered': return unmarkMastered(msg.slug);
    case 'resetAll': return resetAllData();
    case 'getLeetcodeLoginStatus': return getLeetcodeLoginStatus();
    case 'connectGithub': return connectGithub(msg.token, msg.repoName);
    case 'disconnectGithub': return disconnectGithub();
    case 'testGithub': return testGithub();
    case 'githubStartOauth': return githubStartOauth(msg.clientId);
    case 'githubCheckOauth': return githubCheckOauth(msg.repoName);
    case 'githubCancelOauth': return githubCancelOauth();
    default: throw new Error(`Unknown message type: ${msg.type}`);
  }
}

async function getStatus() {
  const [settings, state, problems, session] = await Promise.all([
    getSettings(), getState(), getProblems(), getSession()
  ]);
  const due = getDueProblems(problems, todayISO(), 5);
  return {
    settings, state, due,
    blockActive: await isBlockActive(),
    today: todayISO(),
    signedIn: !!session,
    user: session?.user ? { email: session.user.email, name: session.user.user_metadata?.full_name } : null
  };
}

async function getAuthState() {
  const session = await getSession();
  if (!session) return { signedIn: false };
  return {
    signedIn: true,
    email: session.user?.email,
    name: session.user?.user_metadata?.full_name,
    avatar: session.user?.user_metadata?.avatar_url
  };
}

async function signIn() {
  try {
    const session = await signInWithGoogle();
    await pullFromSupabase();
    // Also push any local data that may not exist remotely yet
    try {
      const localProblems = await getProblems();
      if (Object.keys(localProblems).length) await upsertProblemsBulk(localProblems);
      const localSettings = await getSettings();
      await supaUpsertSettings(localSettings);
      await syncDailyStateToSupabase();
    } catch (e) { console.warn('[LCE] initial push failed', e); }
    await setState({ lastSyncError: null });
    return {
      ok: true,
      email: session.user?.email,
      name: session.user?.user_metadata?.full_name
    };
  } catch (e) {
    await setState({ lastSyncError: e.message });
    return { ok: false, error: e.message };
  }
}

async function doSignOut() {
  await signOut();
  await setState({ lastSyncError: null });
  return { ok: true };
}

async function pullFromSupabase() {
  try {
    const [remoteProblems, remoteSettings, todayRemote] = await Promise.all([
      fetchAllProblems(),
      supaFetchSettings(),
      fetchDailyState(todayISO())
    ]);

    if (remoteProblems && Object.keys(remoteProblems).length) {
      const localProblems = await getProblems();
      const merged = { ...remoteProblems, ...localProblems };
      await chrome.storage.local.set({ problems: merged });
    }

    if (remoteSettings) {
      const localSettings = await getSettings();
      const mergedSettings = { ...localSettings, ...remoteSettings };
      await setSettings(mergedSettings);
    }

    if (todayRemote) {
      const state = await getState();
      await setState({
        solvesToday: Math.max(state.solvesToday || 0, todayRemote.solves_today || 0),
        reviewsToday: Math.max(state.reviewsToday || 0, todayRemote.reviews_today || 0),
        newSolvesToday: Math.max(state.newSolvesToday || 0, todayRemote.new_solves_today || 0),
        overrideUsedToday: Math.max(state.overrideUsedToday || 0, todayRemote.override_used_today || 0),
        streakDays: Math.max(state.streakDays || 0, todayRemote.streak_days || 0)
      });
    }

    await syncBlockRules();
  } catch (e) {
    console.warn('[LCE] pullFromSupabase failed', e);
    await setState({ lastSyncError: e.message });
  }
}

async function isBlockActive() {
  const settings = await getSettings();
  const state = await getState();
  if (state.overrideActiveUntil && new Date(state.overrideActiveUntil) > new Date()) return false;
  const needed = settings.dailyQuota;
  return state.solvesToday < needed;
}

async function syncBlockRules() {
  const settings = await getSettings();
  const active = await isBlockActive();
  if (active) await applyBlockRules(settings.blocklist, true);
  else await clearBlockRules();
}

async function recordSolve(payload) {
  const { slug, number, title, url, difficulty, topics, confidence, notes, needReview, mastered } = payload;
  const problems = await getProblems();
  const existing = problems[slug];
  const settings = await getSettings();

  let updated;
  if (existing) {
    updated = mergeReview(existing, { confidence, notes, needReview, mastered, ladder: settings.intervalLadder });
  } else {
    const base = newProblemDefaults({ slug, number, title, url, difficulty, topics });
    updated = mergeReview(base, { confidence, notes, needReview, mastered, ladder: settings.intervalLadder });
    updated.timesReviewed = 1;
  }
  await setProblem(slug, updated);

  const isReview = !!existing;
  await bumpQuotaCounter(isReview);
  await maybeAdvanceStreak();
  await syncBlockRules();

  await syncProblemToSupabase(slug, updated);
  await syncDailyStateToSupabase();
  await syncProblemToGithub(updated, payload);

  return { ok: true, problem: updated };
}

async function recordManualEntry(payload) {
  return recordSolve(payload);
}

async function bumpQuotaCounter(isReview) {
  const state = await getState();
  const patch = { solvesToday: state.solvesToday + 1 };
  if (isReview) patch.reviewsToday = (state.reviewsToday || 0) + 1;
  else patch.newSolvesToday = (state.newSolvesToday || 0) + 1;
  await setState(patch);
}

async function maybeAdvanceStreak() {
  const settings = await getSettings();
  const state = await getState();
  if (state.solvesToday < settings.dailyQuota) return;
  if (state.streakLastUpdated === todayISO()) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = state.streakLastUpdated === yesterday ? state.streakDays + 1 : 1;
  await setState({ streakDays: newStreak, streakLastUpdated: todayISO() });
}

async function getDueProblemsList(limit = 10) {
  const problems = await getProblems();
  return getDueProblems(problems, todayISO(), limit);
}

async function safeFetchDaily() {
  try { return await fetchDailyChallenge(); }
  catch (e) { console.warn('daily challenge fetch failed', e); return null; }
}

async function safeFetchProblemMeta(slug) {
  try { return await fetchProblemMeta(slug); }
  catch (e) { return { error: e.message }; }
}

async function searchCatalog(query, limit) {
  let catalog = await getCatalog();
  if (!catalog.items.length) {
    try {
      const items = await fetchProblemCatalog(2000);
      catalog = { fetchedAt: todayISO(), items };
      await setCatalog(catalog);
    } catch (e) { return []; }
  }
  const q = query.toLowerCase();
  return catalog.items
    .filter(p => p.title.toLowerCase().includes(q) || String(p.number).includes(q))
    .slice(0, limit);
}

async function getRandomUnsolvedProblem() {
  const catalog = await getCatalog();
  const problems = await getProblems();
  if (!catalog.items.length) {
    try {
      const items = await fetchProblemCatalog(2000);
      await setCatalog({ fetchedAt: todayISO(), items });
      catalog.items = items;
    } catch (e) { console.warn('catalog fetch failed', e); return null; }
  }
  const unsolved = catalog.items.filter(c => {
    const p = problems[c.slug];
    return !p || p.status !== 'Mastered';
  });
  if (!unsolved.length) return null;
  return unsolved[Math.floor(Math.random() * unsolved.length)];
}

async function startOverride(phrase) {
  const settings = await getSettings();
  if (!settings.overrideEnabled) return { ok: false, error: 'Override disabled' };
  if (phrase !== settings.overridePhrase) return { ok: false, error: 'Phrase mismatch' };
  const state = await getState();
  if (state.overrideUsedToday >= settings.overrideCountPerDay) {
    return { ok: false, error: 'No overrides left today' };
  }
  const untilMs = Date.now() + settings.overrideDurationMin * 60 * 1000;
  await setState({
    overrideUsedToday: state.overrideUsedToday + 1,
    overrideActiveUntil: new Date(untilMs).toISOString()
  });
  chrome.alarms.create(ALARM_OVERRIDE_END, { when: untilMs });
  await syncBlockRules();
  await syncDailyStateToSupabase();
  return { ok: true, until: untilMs };
}

async function importHistory() {
  try {
    let { leetcodeUsername } = await getSettings();
    if (!leetcodeUsername) {
      const user = await fetchCurrentUser();
      if (!user?.username) throw new Error('Not logged into LeetCode in this browser');
      leetcodeUsername = user.username;
      await setSettings({ leetcodeUsername });
    }

    const accepted = await fetchAllAcceptedSubmissions(leetcodeUsername);
    const problems = await getProblems();
    const newOnes = {};

    for (const s of accepted) {
      if (problems[s.titleSlug]) continue;
      let meta = null;
      try { meta = await fetchProblemMeta(s.titleSlug); } catch {}
      const firstSolved = s.timestamp
        ? new Date(parseInt(s.timestamp, 10) * 1000).toISOString().slice(0, 10)
        : todayISO();
      const problem = {
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
        history: [{ date: firstSolved, type: 'solve', confidence: null, needReview: false, mastered: true }]
      };
      await setProblem(s.titleSlug, problem);
      newOnes[s.titleSlug] = problem;
    }

    if (Object.keys(newOnes).length) {
      try { await upsertProblemsBulk(newOnes); }
      catch (e) { console.warn('[LCE] supabase bulk import failed', e); }
    }
    return { ok: true, imported: Object.keys(newOnes).length };
  } catch (e) {
    await setState({ lastSyncError: e.message });
    return { ok: false, error: e.message };
  }
}

async function updateSettings(patch) {
  const next = await setSettings(patch);
  await syncBlockRules();
  await scheduleDailyReset();
  try { await supaUpsertSettings(next); }
  catch (e) { console.warn('[LCE] settings supabase sync failed', e); }
  return next;
}

async function forceSyncAll() {
  try {
    const problems = await getProblems();
    const settings = await getSettings();
    await upsertProblemsBulk(problems);
    await supaUpsertSettings(settings);
    await syncDailyStateToSupabase();
    await setState({ lastSyncError: null });
    await setBadgeOk();
    return { ok: true };
  } catch (e) {
    await setState({ lastSyncError: e.message });
    return { ok: false, error: e.message };
  }
}

async function retryLastSync() { return forceSyncAll(); }

async function markMastered(slug) {
  const problems = await getProblems();
  const p = problems[slug];
  if (!p) return { ok: false, error: 'Not found' };
  p.status = 'Mastered';
  await setProblem(slug, p);
  await syncProblemToSupabase(slug, p);
  return { ok: true };
}

async function unmarkMastered(slug) {
  const problems = await getProblems();
  const p = problems[slug];
  if (!p) return { ok: false, error: 'Not found' };
  p.status = 'Active';
  p.srsIntervalDays = 1;
  p.lastReviewed = todayISO();
  await setProblem(slug, p);
  await syncProblemToSupabase(slug, p);
  return { ok: true };
}

async function resetAllData() {
  await chrome.storage.local.clear();
  await clearBlockRules();
  return { ok: true };
}

async function syncProblemToSupabase(slug, problem) {
  try {
    await upsertProblem(slug, problem);
    await setState({ lastSyncError: null });
    await setBadgeOk();
  } catch (e) {
    console.error('supabase problem sync failed', e);
    await setState({ lastSyncError: e.message });
    await setBadgeError();
  }
}

async function syncDailyStateToSupabase() {
  try {
    const state = await getState();
    await upsertDailyState(todayISO(), state);
    await setState({ lastSyncError: null });
    await setBadgeOk();
  } catch (e) {
    console.warn('daily state supabase sync failed', e);
  }
}

async function setBadgeOk() {
  const state = await getState();
  if (state.lastSyncError || state.lastGithubError) return;
  chrome.action.setBadgeText({ text: '' });
}

async function setBadgeError() {
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#D9534F' });
}

// ============================================================
// LeetCode + GitHub (unchanged)
// ============================================================

async function getLeetcodeLoginStatus() {
  try {
    const user = await fetchCurrentUser();
    return { ok: true, isSignedIn: !!user?.isSignedIn, username: user?.username || null };
  } catch (e) {
    return { ok: false, isSignedIn: false, error: e.message };
  }
}

async function connectGithub(token, repoName) {
  try {
    if (!token) throw new Error('Token required');
    const user = await ghFetchUser(token);
    if (!user?.login) throw new Error('Invalid token');
    const settings = await getSettings();
    const repo = repoName || settings.githubRepo || 'leetcode-enforcer-solutions';
    const repoData = await ensureRepo(token, user.login, repo);
    await setSettings({
      githubEnabled: true, githubToken: token, githubOwner: user.login,
      githubRepo: repo, githubBranch: repoData.default_branch || 'main',
      githubRepoUrl: repoData.html_url
    });
    await setState({ lastGithubError: null });
    return { ok: true, owner: user.login, repo, url: repoData.html_url };
  } catch (e) {
    await setState({ lastGithubError: e.message });
    return { ok: false, error: e.message };
  }
}

async function disconnectGithub() {
  await setSettings({ githubEnabled: false, githubToken: null, githubOwner: null, githubRepoUrl: null });
  await setState({ lastGithubError: null, lastGithubCommitUrl: null });
  return { ok: true };
}

async function testGithub() {
  try {
    const { githubToken } = await getSettings();
    if (!githubToken) throw new Error('Not connected');
    const user = await ghFetchUser(githubToken);
    return { ok: true, login: user.login };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function githubStartOauth(clientId) {
  try {
    if (!clientId) throw new Error('Client ID required');
    const data = await startDeviceFlow(clientId, 'repo');
    pendingOauth = {
      clientId, deviceCode: data.device_code, interval: data.interval || 5,
      expiresAt: Date.now() + (data.expires_in || 900) * 1000, lastPollAt: 0
    };
    await setSettings({ githubClientId: clientId });
    return {
      ok: true, userCode: data.user_code,
      verificationUri: data.verification_uri,
      verificationUriComplete: data.verification_uri_complete || `${data.verification_uri}?user_code=${data.user_code}`,
      expiresIn: data.expires_in
    };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function githubCheckOauth(repoName) {
  try {
    if (!pendingOauth) return { ok: false, error: 'No OAuth in progress' };
    if (Date.now() > pendingOauth.expiresAt) {
      pendingOauth = null;
      return { ok: false, error: 'Device code expired — try again' };
    }
    if (Date.now() - pendingOauth.lastPollAt < pendingOauth.interval * 1000) {
      return { ok: true, pending: true };
    }
    pendingOauth.lastPollAt = Date.now();
    const result = await checkDeviceToken(pendingOauth.clientId, pendingOauth.deviceCode);
    if (result.slowDown) pendingOauth.interval += 5;
    if (result.pending) return { ok: true, pending: true };
    if (result.token) {
      pendingOauth = null;
      const connectRes = await connectGithub(result.token, repoName);
      if (!connectRes.ok) return connectRes;
      return { ok: true, pending: false, ...connectRes };
    }
    return { ok: false, error: 'Unexpected OAuth response' };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function githubCancelOauth() { pendingOauth = null; return { ok: true }; }

async function syncProblemToGithub(problem, payload) {
  const settings = await getSettings();
  if (!settings.githubEnabled || !settings.githubToken) return;
  if (!payload.code || !payload.lang) return;
  try {
    const ext = langToExt(payload.lang);
    const folder = slugFolder({ number: problem.number, slug: payload.slug });
    const files = [
      { path: `solution.${ext}`, content: payload.code },
      { path: 'README.md', content: buildProblemReadme(problem) }
    ];
    const message = buildCommitMessage(problem, payload.confidence);
    const result = await pushSolution(settings.githubToken, {
      owner: settings.githubOwner, repo: settings.githubRepo,
      branch: settings.githubBranch, folder, files, message
    });
    await setState({ lastGithubError: null, lastGithubCommitUrl: result.url });
    await setBadgeOk();
  } catch (e) {
    console.error('github push failed', e);
    await setState({ lastGithubError: e.message });
    await setBadgeError();
  }
}

// ============================================================
// Daily reset scheduling
// ============================================================

function computeNextResetISO(hour = 3) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

async function scheduleDailyReset() {
  const settings = await getSettings();
  const next = computeNextResetISO(settings.quotaResetHour);
  chrome.alarms.create(ALARM_DAILY_RESET, {
    when: new Date(next).getTime(),
    periodInMinutes: 24 * 60
  });
}

async function doDailyReset() {
  const state = await getState();
  const settings = await getSettings();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const hitYesterdayQuota = state.streakLastUpdated === yesterday;
  const newStreak = hitYesterdayQuota ? state.streakDays : 0;
  await setState({
    solvesToday: 0, reviewsToday: 0, newSolvesToday: 0,
    overrideUsedToday: 0, overrideActiveUntil: null,
    streakDays: newStreak,
    quotaResetAt: computeNextResetISO(settings.quotaResetHour)
  });
  await syncBlockRules();
}
