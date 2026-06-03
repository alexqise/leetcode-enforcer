export const DEFAULT_SETTINGS = {
  dailyQuota: 1,
  splitReviewQuota: false,
  reviewQuota: 0,
  newSolveQuota: 1,
  intervalLadder: [1, 3, 7, 14, 30],
  blocklist: [
    'youtube.com', 'instagram.com', 'tiktok.com', 'reddit.com',
    'twitter.com', 'x.com', 'facebook.com', 'snapchat.com',
    'netflix.com', 'hulu.com', 'disneyplus.com', 'twitch.tv'
  ],
  overrideEnabled: true,
  overrideCountPerDay: 1,
  overrideDurationMin: 10,
  overridePhrase: 'I am being weak',
  sheetId: null,
  sheetUrl: null,
  quotaResetHour: 3,
  leetcodeUsername: null
};

export const DEFAULT_STATE = {
  quotaResetAt: null,
  solvesToday: 0,
  reviewsToday: 0,
  newSolvesToday: 0,
  overrideUsedToday: 0,
  overrideActiveUntil: null,
  streakDays: 0,
  streakLastUpdated: null,
  lastSyncError: null,
  needsRatingQueue: [],
  installComplete: false
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function setSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getState() {
  const { state } = await chrome.storage.local.get('state');
  return { ...DEFAULT_STATE, ...(state || {}) };
}

export async function setState(patch) {
  const current = await getState();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ state: next });
  return next;
}

export async function getProblems() {
  const { problems } = await chrome.storage.local.get('problems');
  return problems || {};
}

export async function setProblem(slug, problem) {
  const problems = await getProblems();
  problems[slug] = problem;
  await chrome.storage.local.set({ problems });
  return problem;
}

export async function deleteProblem(slug) {
  const problems = await getProblems();
  delete problems[slug];
  await chrome.storage.local.set({ problems });
}

export async function getCatalog() {
  const { problemCatalog } = await chrome.storage.local.get('problemCatalog');
  return problemCatalog || { fetchedAt: null, items: [] };
}

export async function setCatalog(catalog) {
  await chrome.storage.local.set({ problemCatalog: catalog });
}

export async function resetAll() {
  await chrome.storage.local.clear();
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO() {
  return new Date().toISOString();
}
