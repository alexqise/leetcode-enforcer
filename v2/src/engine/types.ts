// Domain types shared across the engine, service worker, and surfaces.
// Shapes mirror v1's chrome.storage.local data exactly — existing user
// data must load unchanged (same extension ID, same storage).

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Unknown'

export type ProblemStatus = 'Active' | 'Mastered'

export interface HistoryEntry {
  date: string
  type: 'solve' | 'review'
  confidence: number | null
  needReview: boolean
  mastered: boolean
}

export interface Problem {
  number: number | null
  title: string
  url: string
  difficulty: Difficulty
  topics: string[]
  firstSolved: string | null
  lastReviewed: string | null
  timesReviewed: number
  srsIntervalDays: number
  status: ProblemStatus
  latestConfidence: number | null
  notes: string
  history: HistoryEntry[]
}

export type ProblemMap = Record<string, Problem>

export interface DueProblem extends Problem {
  slug: string
}

export interface Settings {
  dailyQuota: number
  splitReviewQuota: boolean
  reviewQuota: number
  newSolveQuota: number
  intervalLadder: number[]
  blocklist: string[]
  overrideEnabled: boolean
  overrideCountPerDay: number
  overrideDurationMin: number
  overridePhrase: string
  quotaResetHour: number
  leetcodeUsername: string | null
  githubEnabled: boolean
  githubToken: string | null
  githubOwner: string | null
  githubRepo: string
  githubBranch: string
  githubRepoUrl: string | null
  githubClientId: string | null
}

export interface State {
  quotaResetAt: string | null
  solvesToday: number
  reviewsToday: number
  newSolvesToday: number
  overrideUsedToday: number
  overrideActiveUntil: string | null
  streakDays: number
  streakLastUpdated: string | null
  lastSyncError: string | null
  lastGithubError: string | null
  lastGithubCommitUrl: string | null
  needsRatingQueue: unknown[]
  installComplete: boolean
  historyImportPrompted: boolean
}

export interface CatalogItem {
  slug: string
  number: number
  title: string
  difficulty: Difficulty
  topics: string[]
  url: string
}

export interface Catalog {
  fetchedAt: string | null
  items: CatalogItem[]
}

export interface DailyChallenge extends CatalogItem {
  date: string
}

export type ProblemMeta = CatalogItem

export interface RecentSubmission {
  id: string
  title: string
  titleSlug: string
  timestamp: string
}

export interface SupabaseUser {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
    [key: string]: unknown
  }
}

export interface SupabaseSession {
  access_token: string
  refresh_token?: string
  expires_in?: number
  expires_at?: number
  user?: SupabaseUser
}

/** Payload sent by the LC overlay / manual-entry form on a solve. */
export interface SolvePayload {
  slug: string
  number: number | null
  title: string
  url: string
  difficulty: Difficulty
  topics: string[]
  confidence: number | null
  notes: string
  needReview: boolean
  mastered: boolean
  code?: string | null
  lang?: string | null
}
