// Port of v1 lib/github.js — device-flow OAuth, repo bootstrap, and
// per-solve commits via the Git Data API (blobs → tree → commit → ref).

import type { Problem } from './types'

const API = 'https://api.github.com'
const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'

export interface DeviceFlowStart {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval?: number
}

export async function startDeviceFlow(clientId: string, scope = 'repo'): Promise<DeviceFlowStart> {
  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope }),
  })
  const data = await res.json()
  if (!res.ok || data.error)
    throw new Error(data.error_description || data.error || `${res.status}`)
  return data
}

export interface DeviceTokenCheck {
  token?: string
  pending?: boolean
  slowDown?: boolean
}

export async function checkDeviceToken(
  clientId: string,
  deviceCode: string,
): Promise<DeviceTokenCheck> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  })
  const data = await res.json()
  if (data.access_token) return { token: data.access_token }
  if (data.error === 'authorization_pending') return { pending: true }
  if (data.error === 'slow_down') return { pending: true, slowDown: true }
  throw new Error(data.error_description || data.error || 'Unknown OAuth error')
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

interface CallResult {
  ok: boolean
  status: number
  // GitHub response shapes vary per endpoint; consumers narrow locally.
  // biome-ignore lint/suspicious/noExplicitAny: untyped API boundary
  json: any
}

async function call(token: string, path: string, options: RequestInit = {}): Promise<CallResult> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers(token), ...((options.headers as Record<string, string>) || {}) },
  })
  if (!res.ok && res.status !== 404) {
    const body = await res.text()
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`)
  }
  return { ok: res.ok, status: res.status, json: res.ok ? await res.json() : null }
}

export async function fetchUser(token: string): Promise<{ login: string } | null> {
  const { json } = await call(token, '/user')
  return json
}

export interface RepoInfo {
  default_branch?: string
  html_url: string
}

export async function ensureRepo(token: string, owner: string, repo: string): Promise<RepoInfo> {
  const existing = await call(token, `/repos/${owner}/${repo}`)
  if (existing.ok) return existing.json
  const created = await call(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name: repo,
      private: true,
      auto_init: true,
      description: 'LeetCode solutions synced by LeetCode Enforcer extension.',
    }),
  })
  if (!created.ok) throw new Error('Could not create repo')
  return created.json
}

export interface PushSolutionArgs {
  owner: string
  repo: string
  branch?: string
  folder: string
  files: { path: string; content: string }[]
  message: string
}

export async function pushSolution(
  token: string,
  { owner, repo, branch = 'main', folder, files, message }: PushSolutionArgs,
): Promise<{ commitSha: string; url: string }> {
  const refRes = await call(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`)
  if (!refRes.ok) throw new Error(`Branch "${branch}" not found`)
  const parentCommitSha = refRes.json.object.sha

  const parentCommit = await call(token, `/repos/${owner}/${repo}/git/commits/${parentCommitSha}`)
  const baseTreeSha = parentCommit.json.tree.sha

  const blobs = []
  for (const f of files) {
    const b64 = b64encode(f.content)
    const blob = await call(token, `/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: b64, encoding: 'base64' }),
    })
    blobs.push({ path: `${folder}/${f.path}`, sha: blob.json.sha, mode: '100644', type: 'blob' })
  }

  const tree = await call(token, `/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: blobs }),
  })

  const commit = await call(token, `/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.json.sha,
      parents: [parentCommitSha],
    }),
  })

  await call(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.json.sha, force: false }),
  })

  return { commitSha: commit.json.sha, url: commit.json.html_url }
}

export function langToExt(lang: string | null | undefined): string {
  const map: Record<string, string> = {
    python: 'py',
    python3: 'py',
    pythondata: 'py',
    cpp: 'cpp',
    c: 'c',
    java: 'java',
    javascript: 'js',
    typescript: 'ts',
    csharp: 'cs',
    'c#': 'cs',
    golang: 'go',
    go: 'go',
    rust: 'rs',
    kotlin: 'kt',
    swift: 'swift',
    ruby: 'rb',
    scala: 'scala',
    php: 'php',
    bash: 'sh',
    mysql: 'sql',
    mssql: 'sql',
    oraclesql: 'sql',
    erlang: 'erl',
    elixir: 'ex',
    racket: 'rkt',
    dart: 'dart',
  }
  return map[(lang || '').toLowerCase()] || 'txt'
}

export function slugFolder({ number, slug }: { number: number | null; slug: string }): string {
  const n = String(number || 0).padStart(4, '0')
  return `${n}-${slug}`
}

export function buildProblemReadme(problem: Problem): string {
  const t = problem.topics?.length ? problem.topics.join(', ') : '—'
  return `# ${problem.number ? `${problem.number}. ` : ''}${problem.title}

- **Difficulty**: ${problem.difficulty}
- **Topics**: ${t}
- **URL**: ${problem.url}
- **First solved**: ${problem.firstSolved || '—'}
- **Last reviewed**: ${problem.lastReviewed || '—'}
- **Times reviewed**: ${problem.timesReviewed ?? 0}
- **Latest confidence**: ${problem.latestConfidence ?? '—'} / 5
- **Status**: ${problem.status}

## Notes

${problem.notes || '_No notes yet._'}
`
}

export function buildCommitMessage(
  problem: Problem,
  confidence: number | null | undefined,
): string {
  const num = problem.number ? `${problem.number}. ` : ''
  const conf = typeof confidence === 'number' ? ` · ${confidence}/5` : ''
  return `Solve ${num}${problem.title} [${problem.difficulty}]${conf}`
}

function b64encode(str: string): string {
  // UTF-8 safe base64 (service worker always has btoa; no Node fallback needed)
  return btoa(
    new TextEncoder().encode(str).reduce((acc, byte) => acc + String.fromCharCode(byte), ''),
  )
}
