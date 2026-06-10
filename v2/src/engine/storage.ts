// Port of v1 lib/storage.js. Storage keys and default shapes are
// load-bearing: the same extension ID means existing users' data is
// read by this exact code. (v1's dead `sheetId`/`sheetUrl` defaults are
// dropped — nothing reads them; stale stored values pass through merges
// harmlessly.)

import type { Catalog, Problem, ProblemMap, Settings, State } from './types'

export const DEFAULT_SETTINGS: Settings = {
  dailyQuota: 1,
  splitReviewQuota: false,
  reviewQuota: 0,
  newSolveQuota: 1,
  intervalLadder: [1, 3, 7, 14, 30],
  blocklist: [
    'youtube.com',
    'instagram.com',
    'tiktok.com',
    'reddit.com',
    'twitter.com',
    'x.com',
    'facebook.com',
    'snapchat.com',
    'netflix.com',
    'hulu.com',
    'disneyplus.com',
    'twitch.tv',
  ],
  overrideEnabled: true,
  overrideCountPerDay: 1,
  overrideDurationMin: 10,
  overridePhrase: 'the quick brown fox jumps over the lazy dog',
  quotaResetHour: 3,
  leetcodeUsername: null,
  githubEnabled: false,
  githubToken: null,
  githubOwner: null,
  githubRepo: 'leetcode-enforcer-solutions',
  githubBranch: 'main',
  githubRepoUrl: null,
  githubClientId: null,
}

export const DEFAULT_STATE: State = {
  quotaResetAt: null,
  solvesToday: 0,
  reviewsToday: 0,
  newSolvesToday: 0,
  overrideUsedToday: 0,
  overrideActiveUntil: null,
  streakDays: 0,
  streakLastUpdated: null,
  lastSyncError: null,
  lastGithubError: null,
  lastGithubCommitUrl: null,
  needsRatingQueue: [],
  installComplete: false,
  historyImportPrompted: false,
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings')
  return { ...DEFAULT_SETTINGS, ...(settings || {}) }
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  const next = { ...current, ...patch }
  await chrome.storage.local.set({ settings: next })
  return next
}

export async function getState(): Promise<State> {
  const { state } = await chrome.storage.local.get('state')
  return { ...DEFAULT_STATE, ...(state || {}) }
}

export async function setState(patch: Partial<State>): Promise<State> {
  const current = await getState()
  const next = { ...current, ...patch }
  await chrome.storage.local.set({ state: next })
  return next
}

export async function getProblems(): Promise<ProblemMap> {
  const { problems } = await chrome.storage.local.get('problems')
  return problems || {}
}

export async function setProblem(slug: string, problem: Problem): Promise<Problem> {
  const problems = await getProblems()
  problems[slug] = problem
  await chrome.storage.local.set({ problems })
  return problem
}

export async function deleteProblem(slug: string): Promise<void> {
  const problems = await getProblems()
  delete problems[slug]
  await chrome.storage.local.set({ problems })
}

export async function getCatalog(): Promise<Catalog> {
  const { problemCatalog } = await chrome.storage.local.get('problemCatalog')
  return problemCatalog || { fetchedAt: null, items: [] }
}

export async function setCatalog(catalog: Catalog): Promise<void> {
  await chrome.storage.local.set({ problemCatalog: catalog })
}

export async function resetAll(): Promise<void> {
  await chrome.storage.local.clear()
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function nowISO(): string {
  return new Date().toISOString()
}
