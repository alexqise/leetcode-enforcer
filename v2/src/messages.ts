// The message protocol — single source of truth for every
// chrome.runtime.sendMessage exchange between surfaces/content scripts
// and the service worker. Response shapes mirror v1's handlers exactly
// (SPEC §2): if a shape changes here, the router and every caller break
// at compile time, which is the point.

import type {
  CatalogItem,
  DailyChallenge,
  DueProblem,
  Problem,
  ProblemMeta,
  Settings,
  SolvePayload,
  State,
} from './engine/types'

// ============================================================
// Requests
// ============================================================

export type Msg =
  | { type: 'getStatus' }
  | { type: 'recordSolve'; payload: SolvePayload }
  | { type: 'getDueProblems'; limit?: number }
  | { type: 'fetchDailyChallenge' }
  | { type: 'getRandomUnsolved' }
  | { type: 'manualEntry'; payload: SolvePayload }
  | { type: 'getProblemMeta'; slug: string }
  | { type: 'searchCatalog'; query: string; limit?: number }
  | { type: 'startOverride'; phrase: string }
  | { type: 'signInGoogle' }
  | { type: 'signOut' }
  | { type: 'getAuthState' }
  | { type: 'importLeetcodeHistory' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'forceSyncAll' }
  | { type: 'retryLastSync' }
  | { type: 'markMastered'; slug: string }
  | { type: 'unmarkMastered'; slug: string }
  | { type: 'resetAll' }
  | { type: 'getLeetcodeLoginStatus' }
  | { type: 'connectGithub'; token: string; repoName?: string }
  | { type: 'disconnectGithub' }
  | { type: 'testGithub' }
  | { type: 'githubStartOauth'; clientId: string }
  | { type: 'githubCheckOauth'; repoName?: string }
  | { type: 'githubCancelOauth' }

export type MsgType = Msg['type']

// ============================================================
// Response shapes
// ============================================================

export interface StatusResponse {
  settings: Settings
  state: State
  due: DueProblem[]
  blockActive: boolean
  today: string
  signedIn: boolean
  user: { email?: string; name?: string } | null
}

export type AuthState =
  | { signedIn: false }
  | { signedIn: true; email?: string; name?: string; avatar?: string }

export type Ok = { ok: true }
export type OkOrError = Ok | { ok: false; error: string }

export type SignInResult =
  | { ok: true; email?: string; name?: string }
  | { ok: false; error: string }

export type OverrideResult = { ok: true; until: number } | { ok: false; error: string }

export type ImportResult = { ok: true; imported: number } | { ok: false; error: string }

export interface LeetcodeLoginStatus {
  ok: boolean
  isSignedIn: boolean
  username?: string | null
  error?: string
}

export type GithubConnectResult =
  | { ok: true; owner: string; repo: string; url: string }
  | { ok: false; error: string }

export type GithubOauthStartResult =
  | {
      ok: true
      userCode: string
      verificationUri: string
      verificationUriComplete: string
      expiresIn: number
    }
  | { ok: false; error: string }

export type GithubOauthCheckResult =
  | { ok: true; pending: true }
  | { ok: true; pending: false; owner: string; repo: string; url: string }
  | { ok: false; error: string }

interface MsgResponses {
  getStatus: StatusResponse
  recordSolve: { ok: true; problem: Problem }
  getDueProblems: DueProblem[]
  fetchDailyChallenge: DailyChallenge | null
  getRandomUnsolved: CatalogItem | null
  manualEntry: { ok: true; problem: Problem }
  getProblemMeta: ProblemMeta | null | { error: string }
  searchCatalog: CatalogItem[]
  startOverride: OverrideResult
  signInGoogle: SignInResult
  signOut: Ok
  getAuthState: AuthState
  importLeetcodeHistory: ImportResult
  updateSettings: Settings
  forceSyncAll: OkOrError
  retryLastSync: OkOrError
  markMastered: OkOrError
  unmarkMastered: OkOrError
  resetAll: Ok
  getLeetcodeLoginStatus: LeetcodeLoginStatus
  connectGithub: GithubConnectResult
  disconnectGithub: Ok
  testGithub: { ok: true; login: string } | { ok: false; error: string }
  githubStartOauth: GithubOauthStartResult
  githubCheckOauth: GithubOauthCheckResult
  githubCancelOauth: Ok
}

export type MsgResponse<T extends MsgType> = MsgResponses[T]

/**
 * The router catches thrown errors and responds with this envelope.
 * `ok?: never` keeps it structurally distinct from handler-level
 * `{ ok: false, error }` results so isMsgError narrows unions correctly.
 */
export interface MsgError {
  error: string
  ok?: never
}

export type MsgResult<T extends MsgType> = MsgResponse<T> | MsgError

export function isMsgError(res: unknown): res is MsgError {
  return (
    typeof res === 'object' &&
    res !== null &&
    !('ok' in res) &&
    'error' in res &&
    typeof (res as MsgError).error === 'string'
  )
}

// ============================================================
// Typed send — the only way surfaces talk to the service worker
// ============================================================

export async function send<M extends Msg>(msg: M): Promise<MsgResult<M['type']>> {
  try {
    return await chrome.runtime.sendMessage(msg)
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
