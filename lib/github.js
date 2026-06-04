const API = 'https://api.github.com';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

export async function startDeviceFlow(clientId, scope = 'repo') {
  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope })
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error_description || data.error || `${res.status}`);
  return data;
}

export async function checkDeviceToken(clientId, deviceCode) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  });
  const data = await res.json();
  if (data.access_token) return { token: data.access_token };
  if (data.error === 'authorization_pending') return { pending: true };
  if (data.error === 'slow_down') return { pending: true, slowDown: true };
  throw new Error(data.error_description || data.error || 'Unknown OAuth error');
}

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

async function call(token, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers(token), ...(options.headers || {}) }
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  return { ok: res.ok, status: res.status, json: res.ok ? await res.json() : null };
}

export async function fetchUser(token) {
  const { json } = await call(token, '/user');
  return json;
}

export async function ensureRepo(token, owner, repo) {
  const existing = await call(token, `/repos/${owner}/${repo}`);
  if (existing.ok) return existing.json;
  const created = await call(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name: repo,
      private: true,
      auto_init: true,
      description: 'LeetCode solutions synced by LeetCode Enforcer extension.'
    })
  });
  if (!created.ok) throw new Error('Could not create repo');
  return created.json;
}

export async function pushSolution(token, { owner, repo, branch = 'main', folder, files, message }) {
  const refRes = await call(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`);
  if (!refRes.ok) throw new Error(`Branch "${branch}" not found`);
  const parentCommitSha = refRes.json.object.sha;

  const parentCommit = await call(token, `/repos/${owner}/${repo}/git/commits/${parentCommitSha}`);
  const baseTreeSha = parentCommit.json.tree.sha;

  const blobs = [];
  for (const f of files) {
    const b64 = b64encode(f.content);
    const blob = await call(token, `/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: b64, encoding: 'base64' })
    });
    blobs.push({ path: `${folder}/${f.path}`, sha: blob.json.sha, mode: '100644', type: 'blob' });
  }

  const tree = await call(token, `/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: blobs })
  });

  const commit = await call(token, `/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.json.sha,
      parents: [parentCommitSha]
    })
  });

  await call(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.json.sha, force: false })
  });

  return { commitSha: commit.json.sha, url: commit.json.html_url };
}

export function langToExt(lang) {
  const map = {
    python: 'py', python3: 'py', pythondata: 'py',
    cpp: 'cpp', c: 'c', java: 'java',
    javascript: 'js', typescript: 'ts',
    csharp: 'cs', 'c#': 'cs',
    golang: 'go', go: 'go',
    rust: 'rs', kotlin: 'kt', swift: 'swift',
    ruby: 'rb', scala: 'scala', php: 'php',
    bash: 'sh', mysql: 'sql', mssql: 'sql', oraclesql: 'sql',
    erlang: 'erl', elixir: 'ex', racket: 'rkt',
    dart: 'dart'
  };
  return map[(lang || '').toLowerCase()] || 'txt';
}

export function slugFolder({ number, slug }) {
  const n = String(number || 0).padStart(4, '0');
  return `${n}-${slug}`;
}

export function buildProblemReadme(problem) {
  const t = problem.topics?.length ? problem.topics.join(', ') : '—';
  return `# ${problem.number ? problem.number + '. ' : ''}${problem.title}

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
`;
}

export function buildCommitMessage(problem, confidence) {
  const num = problem.number ? `${problem.number}. ` : '';
  const conf = typeof confidence === 'number' ? ` · ${confidence}/5` : '';
  return `Solve ${num}${problem.title} [${problem.difficulty}]${conf}`;
}

function b64encode(str) {
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(str)));
  }
  return Buffer.from(str, 'utf-8').toString('base64');
}
