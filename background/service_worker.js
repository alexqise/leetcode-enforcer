import {
  getSettings, setSettings, getState, setState, getProblems, setProblem,
  getCatalog, setCatalog, todayISO, nowISO, DEFAULT_STATE
} from '../lib/storage.js';
import { mergeReview, newProblemDefaults, getDueProblems, isDue } from '../lib/srs.js';
import { applyBlockRules, clearBlockRules } from '../lib/blocklist.js';
import { getAuthToken } from '../lib/oauth.js';
import {
  createSpreadsheet, upsertProblemRow, bulkUpsertProblems, writeStatsData, applyStyles
} from '../lib/sheets.js';
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
  const state = await getState();
  if (!state.installComplete) {
    await setState({
      ...DEFAULT_STATE,
      quotaResetAt: computeNextResetISO((await getSettings()).quotaResetHour),
      streakLastUpdated: todayISO()
    });
  }
  if (details.reason === 'install') {
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
    case 'connectGoogle': return connectGoogle();
    case 'importLeetcodeHistory': return importHistory();
    case 'updateSettings': return updateSettings(msg.patch);
    case 'forceSyncAll': return forceSyncAll();
    case 'retryLastSync': return retryLastSync();
    case 'restyleSheet': return restyleSheet();
    case 'markMastered': return markMastered(msg.slug);
    case 'unmarkMastered': return unmarkMastered(msg.slug);
    case 'resetAll': return resetAllData();
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
  const [settings, state, problems] = await Promise.all([getSettings(), getState(), getProblems()]);
  const due = getDueProblems(problems, todayISO(), 5);
  return {
    settings, state, due,
    blockActive: await isBlockActive(),
    today: todayISO()
  };
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
  if (active) {
    await applyBlockRules(settings.blocklist, true);
  } else {
    await clearBlockRules();
  }
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

  await syncProblemToSheet(updated);
  await syncStatsToSheet();
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
  try {
    return await fetchDailyChallenge();
  } catch (e) {
    console.warn('daily challenge fetch failed', e);
    return null;
  }
}

async function safeFetchProblemMeta(slug) {
  try {
    return await fetchProblemMeta(slug);
  } catch (e) {
    return { error: e.message };
  }
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
    } catch (e) {
      console.warn('catalog fetch failed', e);
      return null;
    }
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
  return { ok: true, until: untilMs };
}

async function connectGoogle() {
  try {
    const token = await getAuthToken(true);
    const settings = await getSettings();
    if (!settings.sheetId) {
      const { spreadsheetId, spreadsheetUrl } = await createSpreadsheet(token);
      await setSettings({ sheetId: spreadsheetId, sheetUrl: spreadsheetUrl });
    } else if (!settings.sheetUrl) {
      await setSettings({ sheetUrl: `https://docs.google.com/spreadsheets/d/${settings.sheetId}/edit` });
    }
    try {
      const user = await fetchCurrentUser();
      if (user?.username) await setSettings({ leetcodeUsername: user.username });
    } catch (e) { /* user may not be logged into LC yet, that's fine */ }
    await setState({ lastSyncError: null });
    return { ok: true };
  } catch (e) {
    await setState({ lastSyncError: e.message });
    return { ok: false, error: e.message };
  }
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
    const newRows = [];

    for (const s of accepted) {
      if (problems[s.titleSlug]) continue;
      let meta = null;
      try { meta = await fetchProblemMeta(s.titleSlug); } catch {}
      const today = todayISO();
      const firstSolved = s.timestamp
        ? new Date(parseInt(s.timestamp, 10) * 1000).toISOString().slice(0, 10)
        : today;
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
      newRows.push(problem);
    }

    if (newRows.length) {
      const { sheetId } = await getSettings();
      if (sheetId) {
        const token = await getAuthToken(false);
        await bulkUpsertProblems(token, sheetId, newRows);
        await syncStatsToSheet();
      }
    }
    return { ok: true, imported: newRows.length };
  } catch (e) {
    await setState({ lastSyncError: e.message });
    return { ok: false, error: e.message };
  }
}

async function updateSettings(patch) {
  const next = await setSettings(patch);
  await syncBlockRules();
  await scheduleDailyReset();
  return next;
}

async function forceSyncAll() {
  try {
    const { sheetId } = await getSettings();
    if (!sheetId) throw new Error('Not connected to Sheets');
    const token = await getAuthToken(false);
    const problems = await getProblems();
    await bulkUpsertProblems(token, sheetId, Object.values(problems));
    await syncStatsToSheet();
    await setState({ lastSyncError: null });
    return { ok: true };
  } catch (e) {
    await setState({ lastSyncError: e.message });
    return { ok: false, error: e.message };
  }
}

async function retryLastSync() {
  return forceSyncAll();
}

async function restyleSheet() {
  try {
    const { sheetId } = await getSettings();
    if (!sheetId) throw new Error('Not connected to Sheets');
    const token = await getAuthToken(true);
    await applyStyles(token, sheetId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function markMastered(slug) {
  const problems = await getProblems();
  const p = problems[slug];
  if (!p) return { ok: false, error: 'Not found' };
  p.status = 'Mastered';
  await setProblem(slug, p);
  await syncProblemToSheet(p);
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
  await syncProblemToSheet(p);
  return { ok: true };
}

async function resetAllData() {
  await chrome.storage.local.clear();
  await clearBlockRules();
  return { ok: true };
}

async function syncProblemToSheet(problem) {
  try {
    const { sheetId } = await getSettings();
    if (!sheetId) return;
    const token = await getAuthToken(false);
    await upsertProblemRow(token, sheetId, problem);
    await setState({ lastSyncError: null });
    await setBadgeOk();
  } catch (e) {
    console.error('sync problem failed', e);
    await setState({ lastSyncError: e.message });
    await setBadgeError();
  }
}

async function syncStatsToSheet() {
  try {
    const { sheetId } = await getSettings();
    if (!sheetId) return;
    const token = await getAuthToken(false);
    const problems = await getProblems();
    const state = await getState();
    const stats = computeStats(problems, state);
    await writeStatsData(token, sheetId, stats);
    await setState({ lastSyncError: null });
    await setBadgeOk();
  } catch (e) {
    console.error('sync stats failed', e);
    await setState({ lastSyncError: e.message });
    await setBadgeError();
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

async function connectGithub(token, repoName) {
  try {
    if (!token) throw new Error('Token required');
    const user = await ghFetchUser(token);
    if (!user?.login) throw new Error('Invalid token');
    const settings = await getSettings();
    const repo = repoName || settings.githubRepo || 'leetcode-enforcer-solutions';
    const repoData = await ensureRepo(token, user.login, repo);
    await setSettings({
      githubEnabled: true,
      githubToken: token,
      githubOwner: user.login,
      githubRepo: repo,
      githubBranch: repoData.default_branch || 'main',
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
  await setSettings({
    githubEnabled: false, githubToken: null, githubOwner: null,
    githubRepoUrl: null
  });
  await setState({ lastGithubError: null, lastGithubCommitUrl: null });
  return { ok: true };
}

async function testGithub() {
  try {
    const { githubToken } = await getSettings();
    if (!githubToken) throw new Error('Not connected');
    const user = await ghFetchUser(githubToken);
    return { ok: true, login: user.login };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function githubStartOauth(clientId) {
  try {
    if (!clientId) throw new Error('Client ID required');
    const data = await startDeviceFlow(clientId, 'repo');
    pendingOauth = {
      clientId,
      deviceCode: data.device_code,
      interval: data.interval || 5,
      expiresAt: Date.now() + (data.expires_in || 900) * 1000,
      lastPollAt: 0
    };
    await setSettings({ githubClientId: clientId });
    return {
      ok: true,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      verificationUriComplete: data.verification_uri_complete || `${data.verification_uri}?user_code=${data.user_code}`,
      expiresIn: data.expires_in
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
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
      const clientId = pendingOauth.clientId;
      pendingOauth = null;
      const connectRes = await connectGithub(result.token, repoName);
      if (!connectRes.ok) return connectRes;
      return { ok: true, pending: false, ...connectRes };
    }
    return { ok: false, error: 'Unexpected OAuth response' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function githubCancelOauth() {
  pendingOauth = null;
  return { ok: true };
}

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
      owner: settings.githubOwner,
      repo: settings.githubRepo,
      branch: settings.githubBranch,
      folder, files, message
    });
    await setState({ lastGithubError: null, lastGithubCommitUrl: result.url });
    await setBadgeOk();
  } catch (e) {
    console.error('github push failed', e);
    await setState({ lastGithubError: e.message });
    await setBadgeError();
  }
}

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
    solvesToday: 0,
    reviewsToday: 0,
    newSolvesToday: 0,
    overrideUsedToday: 0,
    overrideActiveUntil: null,
    streakDays: newStreak,
    quotaResetAt: computeNextResetISO(settings.quotaResetHour)
  });

  await syncBlockRules();
}
