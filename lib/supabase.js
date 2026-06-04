const SUPABASE_URL = 'https://bxlvcyhsoykfmiwxepby.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8GZ4epUM93ciqJZzXFEaDw_A84W9X78';
const SESSION_KEY = 'supabaseSession';

// ============================================================
// Auth — PKCE OAuth via Supabase, opens Google through launchWebAuthFlow
// ============================================================

export async function signInWithGoogle() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const redirectUri = chrome.identity.getRedirectURL();

  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?` + new URLSearchParams({
    provider: 'google',
    redirect_to: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  console.log('[LCE/supabase] redirectUri =', redirectUri);
  console.log('[LCE/supabase] authUrl =', authUrl);

  const callbackUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (out) => {
      if (chrome.runtime.lastError || !out) {
        reject(new Error(chrome.runtime.lastError?.message || 'Auth cancelled'));
      } else resolve(out);
    });
  });

  const parsed = new URL(callbackUrl);
  const code = parsed.searchParams.get('code');
  if (!code) {
    const err = parsed.searchParams.get('error_description') || parsed.searchParams.get('error') || 'No code returned';
    throw new Error(err);
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange ${res.status}: ${body.slice(0, 200)}`);
  }
  const session = await res.json();
  await saveSession(session);
  return session;
}

export async function signOut() {
  const session = await getSession();
  if (session?.access_token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${session.access_token}` }
      });
    } catch (e) { /* ignore */ }
  }
  await chrome.storage.local.remove(SESSION_KEY);
}

export async function getSession() {
  const { [SESSION_KEY]: session } = await chrome.storage.local.get(SESSION_KEY);
  return session || null;
}

export async function getCurrentUser() {
  const s = await getValidSession();
  return s?.user || null;
}

async function getValidSession() {
  let session = await getSession();
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at || (session.expires_in ? now + session.expires_in : 0);
  if (expiresAt - now < 60) {
    if (!session.refresh_token) {
      await chrome.storage.local.remove(SESSION_KEY);
      return null;
    }
    session = await refreshSession(session.refresh_token);
  }
  return session;
}

async function refreshSession(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  if (!res.ok) {
    await chrome.storage.local.remove(SESSION_KEY);
    const body = await res.text();
    throw new Error(`Session refresh failed (${res.status}). Sign in again.`);
  }
  const session = await res.json();
  await saveSession(session);
  return session;
}

async function saveSession(session) {
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at && session.expires_in) session.expires_at = now + session.expires_in;
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

// ============================================================
// REST helpers (PostgREST)
// ============================================================

async function rest(method, path, body = null, prefer = 'return=representation') {
  const session = await getValidSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'Prefer': prefer
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// ============================================================
// Problems
// ============================================================

function problemLocalToDb(slug, p) {
  return {
    slug,
    number: p.number ?? null,
    title: p.title,
    url: p.url,
    difficulty: p.difficulty,
    topics: p.topics || [],
    first_solved: p.firstSolved || null,
    last_reviewed: p.lastReviewed || null,
    times_reviewed: p.timesReviewed ?? 1,
    srs_interval_days: p.srsIntervalDays ?? 1,
    status: p.status || 'Active',
    latest_confidence: p.latestConfidence ?? null,
    notes: p.notes || '',
    history: p.history || [],
    updated_at: new Date().toISOString()
  };
}

function problemDbToLocal(row) {
  return {
    number: row.number,
    title: row.title,
    url: row.url,
    difficulty: row.difficulty,
    topics: row.topics || [],
    firstSolved: row.first_solved,
    lastReviewed: row.last_reviewed,
    timesReviewed: row.times_reviewed,
    srsIntervalDays: row.srs_interval_days,
    status: row.status,
    latestConfidence: row.latest_confidence,
    notes: row.notes || '',
    history: row.history || []
  };
}

export async function upsertProblem(slug, problem) {
  const row = problemLocalToDb(slug, problem);
  return rest('POST', '/problems?on_conflict=user_id,slug', [row],
    'resolution=merge-duplicates,return=minimal');
}

export async function upsertProblemsBulk(problems) {
  const rows = Object.entries(problems).map(([slug, p]) => problemLocalToDb(slug, p));
  if (rows.length === 0) return;
  return rest('POST', '/problems?on_conflict=user_id,slug', rows,
    'resolution=merge-duplicates,return=minimal');
}

export async function fetchAllProblems() {
  const rows = await rest('GET', '/problems?select=*');
  const out = {};
  for (const r of (rows || [])) out[r.slug] = problemDbToLocal(r);
  return out;
}

// ============================================================
// Settings
// ============================================================

function settingsLocalToDb(s) {
  return {
    daily_quota: s.dailyQuota,
    blocklist: s.blocklist,
    interval_ladder: s.intervalLadder,
    override_enabled: s.overrideEnabled,
    override_count_per_day: s.overrideCountPerDay,
    override_duration_min: s.overrideDurationMin,
    override_phrase: s.overridePhrase,
    quota_reset_hour: s.quotaResetHour,
    updated_at: new Date().toISOString()
  };
}

function settingsDbToLocal(row) {
  return {
    dailyQuota: row.daily_quota,
    blocklist: row.blocklist || [],
    intervalLadder: row.interval_ladder || [1, 3, 7, 14, 30],
    overrideEnabled: row.override_enabled,
    overrideCountPerDay: row.override_count_per_day,
    overrideDurationMin: row.override_duration_min,
    overridePhrase: row.override_phrase,
    quotaResetHour: row.quota_reset_hour
  };
}

export async function upsertSettings(settings) {
  return rest('POST', '/settings?on_conflict=user_id', [settingsLocalToDb(settings)],
    'resolution=merge-duplicates,return=minimal');
}

export async function fetchSettings() {
  const rows = await rest('GET', '/settings?select=*&limit=1');
  return rows?.[0] ? settingsDbToLocal(rows[0]) : null;
}

// ============================================================
// Daily state
// ============================================================

function stateLocalToDb(day, s) {
  return {
    day,
    solves_today: s.solvesToday ?? 0,
    reviews_today: s.reviewsToday ?? 0,
    new_solves_today: s.newSolvesToday ?? 0,
    override_used_today: s.overrideUsedToday ?? 0,
    streak_days: s.streakDays ?? 0
  };
}

export async function upsertDailyState(day, state) {
  return rest('POST', '/daily_state?on_conflict=user_id,day', [stateLocalToDb(day, state)],
    'resolution=merge-duplicates,return=minimal');
}

export async function fetchDailyState(day) {
  const rows = await rest('GET', `/daily_state?day=eq.${day}&select=*&limit=1`);
  return rows?.[0] || null;
}

// ============================================================
// PKCE helpers
// ============================================================

function generateCodeVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
}

async function sha256Base64Url(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return base64UrlEncode(new Uint8Array(buf));
}

function base64UrlEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
