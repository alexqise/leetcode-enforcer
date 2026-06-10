import { getSettings, setSettings, DEFAULT_SETTINGS } from '../lib/storage.js';
import { confirmDialog, noticeDialog } from '../lib/dialog.js';

const $ = sel => document.querySelector(sel);
let settings = { ...DEFAULT_SETTINGS };

init().catch(err => {
  console.error('options init failed', err);
  document.body.insertAdjacentHTML('afterbegin',
    `<div style="padding:12px 16px;background:rgba(242,111,111,0.10);border:1px solid rgba(242,111,111,0.25);color:#F26F6F;font-size:12.5px;border-radius:6px;margin:12px;font-family:Inter,sans-serif">Init failed: ${escapeHtml(err.message || String(err))}</div>`);
});

async function init() {
  settings = await getSettings();
  await hydrate();
  wire();
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes.settings || changes.state) {
      settings = await getSettings();
      await hydrate();
    }
  });
}

async function hydrate() {
  $('#quota').value = settings.dailyQuota;
  $('#quota-value').textContent = settings.dailyQuota;
  $('#split-quota').checked = !!settings.splitReviewQuota;
  $('#split-fields').hidden = !settings.splitReviewQuota;
  $('#new-solve-quota').value = settings.newSolveQuota ?? 1;
  $('#review-quota').value = settings.reviewQuota ?? 0;

  $('#ladder').value = (settings.intervalLadder || [1,3,7,14,30]).join(', ');

  $('#override-enabled').checked = !!settings.overrideEnabled;
  $('#override-count').value = settings.overrideCountPerDay ?? 1;
  $('#override-duration').value = settings.overrideDurationMin ?? 10;
  $('#override-phrase').value = settings.overridePhrase ?? 'the quick brown fox jumps over the lazy dog';

  $('#reset-hour').value = settings.quotaResetHour ?? 3;

  renderBlocklist();

  const auth = await send({ type: 'getAuthState' });
  if (auth?.signedIn) {
    $('#auth-signed-out').hidden = true;
    $('#auth-signed-in').hidden = false;
    $('#auth-email').textContent = auth.email || '(unknown)';
  } else {
    $('#auth-signed-out').hidden = false;
    $('#auth-signed-in').hidden = true;
  }

  if (settings.githubEnabled && settings.githubToken) {
    $('#gh-disconnected').hidden = true;
    $('#gh-connected').hidden = false;
    $('#gh-login').textContent = settings.githubOwner || '?';
    $('#gh-repo-link').href = settings.githubRepoUrl || '#';
    const { state = {} } = await chrome.storage.local.get('state');
    if (state.lastGithubCommitUrl) {
      $('#gh-last-commit').innerHTML = `Last commit: <a href="${state.lastGithubCommitUrl}" target="_blank">view</a>`;
    } else {
      $('#gh-last-commit').textContent = '';
    }
  } else {
    $('#gh-disconnected').hidden = false;
    $('#gh-connected').hidden = true;
    $('#gh-repo').value = settings.githubRepo || 'leetcode-enforcer-solutions';
    $('#gh-oauth-repo').value = settings.githubRepo || 'leetcode-enforcer-solutions';
    if (settings.githubClientId) $('#gh-client-id').value = settings.githubClientId;
  }
}

function renderBlocklist() {
  const el = $('#blocklist');
  el.innerHTML = '';
  for (const d of settings.blocklist) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `${escapeHtml(d)}<button type="button" title="Remove ${escapeHtml(d)}" aria-label="Remove ${escapeHtml(d)}">×</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      settings.blocklist = settings.blocklist.filter(x => x !== d);
      renderBlocklist();
    });
    el.appendChild(chip);
  }
}

function wire() {
  $('#quota').addEventListener('input', (e) => {
    $('#quota-value').textContent = e.target.value;
  });

  $('#split-quota').addEventListener('change', (e) => {
    $('#split-fields').hidden = !e.target.checked;
  });

  $('#add-site-btn').addEventListener('click', addSite);
  $('#add-site').addEventListener('keydown', (e) => { if (e.key === 'Enter') addSite(); });

  $('#signin-google').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const orig = e.target.innerHTML;
    e.target.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Signing in…</span>';
    const res = await send({ type: 'signInGoogle' });
    e.target.disabled = false;
    e.target.innerHTML = orig;
    if (!res?.ok) {
      await noticeDialog({ title: 'Sign-in failed', body: res?.error || 'Unknown error.' });
      return;
    }
    await hydrate();
    refreshLeetcodeLoginState();
  });

  $('#signout').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Sign out?',
      body: 'Your local data stays on this device.',
      confirmLabel: 'Sign out'
    });
    if (!ok) return;
    await send({ type: 'signOut' });
    await hydrate();
  });

  $('#force-sync').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const orig = e.target.textContent;
    e.target.innerHTML = '<span class="spinner" aria-hidden="true"></span> Syncing';
    const res = await send({ type: 'forceSyncAll' });
    e.target.disabled = false;
    if (res?.ok === false) {
      e.target.textContent = orig;
      await noticeDialog({ title: 'Sync failed', body: res.error || 'Unknown error.' });
    } else {
      e.target.textContent = 'Synced';
      setTimeout(() => { e.target.textContent = orig; }, 1500);
    }
  });

  $('#reset-all').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Reset all data?',
      body: 'Wipes all local data on this device — problems, streak, settings, and saved tokens. The spreadsheet itself is not deleted. This cannot be undone.',
      confirmLabel: 'Reset all data',
      danger: true
    });
    if (!ok) return;
    await send({ type: 'resetAll' });
    settings = { ...DEFAULT_SETTINGS };
    await hydrate();
    $('#save-status').textContent = 'Reset complete';
    setTimeout(() => { $('#save-status').textContent = ''; }, 3000);
  });

  $('#save').addEventListener('click', save);

  refreshLeetcodeLoginState();

  $('#import-history').addEventListener('click', async (e) => {
    e.target.disabled = true;
    $('#import-status').innerHTML = '<span class="spinner" aria-hidden="true"></span> Importing';
    const res = await send({ type: 'importLeetcodeHistory' });
    e.target.disabled = false;
    if (res?.error || res?.ok === false) {
      $('#import-status').textContent = 'Failed: ' + (res?.error || 'unknown');
    } else {
      $('#import-status').textContent = `Imported ${res.imported} problems as Mastered`;
    }
  });

  if (location.hash === '#github') {
    setTimeout(() => $('#github')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  $('#gh-connect').addEventListener('click', async () => {
    const token = $('#gh-token').value.trim();
    const repoName = $('#gh-repo').value.trim() || 'leetcode-enforcer-solutions';
    if (!token) {
      await noticeDialog({ title: 'Token required', body: 'Paste a fine-grained personal access token first.' });
      $('#gh-token').focus();
      return;
    }
    $('#gh-connect').disabled = true;
    $('#gh-connect').innerHTML = '<span class="spinner" aria-hidden="true"></span> Connecting';
    const res = await send({ type: 'connectGithub', token, repoName });
    $('#gh-connect').disabled = false;
    $('#gh-connect').textContent = 'Connect GitHub';
    if (!res.ok) {
      await noticeDialog({ title: 'GitHub connection failed', body: res.error || 'Unknown error.' });
      return;
    }
    $('#gh-token').value = '';
    settings = await getSettings();
    await hydrate(); // connected status row is the confirmation
  });
  $('#gh-disconnect').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Disconnect GitHub?',
      body: 'Removes the saved token from this device. The repo and its commits are kept.',
      confirmLabel: 'Disconnect'
    });
    if (!ok) return;
    await send({ type: 'disconnectGithub' });
    settings = await getSettings();
    await hydrate();
  });
  $('#gh-test').addEventListener('click', async () => {
    const res = await send({ type: 'testGithub' });
    if (res.ok) await noticeDialog({ title: 'GitHub connected', body: `Authenticated as ${res.login}.` });
    else await noticeDialog({ title: 'GitHub test failed', body: res.error || 'Unknown error.' });
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const mode = tab.dataset.mode;
      document.querySelectorAll('.gh-mode').forEach(m => { m.hidden = m.dataset.mode !== mode; });
    });
  });

  let oauthPollHandle = null;

  $('#gh-oauth-start').addEventListener('click', async () => {
    const btn = $('#gh-oauth-start');
    const clientId = $('#gh-client-id').value.trim();
    const repoName = $('#gh-oauth-repo').value.trim() || 'leetcode-enforcer-solutions';
    if (!clientId) {
      await noticeDialog({ title: 'Client ID required', body: 'Paste your OAuth App Client ID first.' });
      $('#gh-client-id').focus();
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Starting';
    $('#gh-oauth-status') && ($('#gh-oauth-status').textContent = '');

    const res = await send({ type: 'githubStartOauth', clientId });

    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = 'Authorize via GitHub';
      await noticeDialog({ title: "Couldn't start authorization", body: res.error || 'Unknown error.' });
      return;
    }

    $('#gh-user-code').textContent = res.userCode;
    $('#gh-open-verification').href = res.verificationUriComplete || res.verificationUri;
    $('#gh-oauth-pending').hidden = false;
    $('#gh-oauth-status').textContent = 'Waiting for you to authorize on GitHub…';
    window.open(res.verificationUriComplete || res.verificationUri, '_blank');
    startOauthPolling(repoName, btn);
  });

  $('#gh-oauth-cancel').addEventListener('click', async () => {
    stopOauthPolling();
    await send({ type: 'githubCancelOauth' });
    $('#gh-oauth-pending').hidden = true;
    const btn = $('#gh-oauth-start');
    btn.disabled = false;
    btn.textContent = 'Authorize via GitHub';
  });

  function startOauthPolling(repoName, originalBtn) {
    stopOauthPolling();
    oauthPollHandle = setInterval(async () => {
      const res = await send({ type: 'githubCheckOauth', repoName });
      if (!res.ok) {
        stopOauthPolling();
        $('#gh-oauth-status').textContent = 'Error: ' + res.error;
        originalBtn.disabled = false;
        originalBtn.textContent = 'Authorize via GitHub';
        return;
      }
      if (res.pending) {
        $('#gh-oauth-status').textContent = 'Waiting for you to authorize on GitHub…';
        return;
      }
      stopOauthPolling();
      $('#gh-oauth-pending').hidden = true;
      originalBtn.disabled = false;
      originalBtn.textContent = 'Authorize via GitHub';
      settings = await getSettings();
      await hydrate(); // connected status row is the confirmation
    }, 3000);
  }

  function stopOauthPolling() {
    if (oauthPollHandle) { clearInterval(oauthPollHandle); oauthPollHandle = null; }
  }
}

function addSite() {
  const v = $('#add-site').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!v) return;
  if (settings.blocklist.includes(v)) return;
  settings.blocklist.push(v);
  $('#add-site').value = '';
  renderBlocklist();
}

function num(val, fallback) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function refreshLeetcodeLoginState() {
  const btn = $('#import-history');
  const hint = $('#import-login-hint');
  if (!btn || !hint) return;
  hint.textContent = 'Checking LeetCode login…';
  const res = await send({ type: 'getLeetcodeLoginStatus' });
  if (res?.isSignedIn) {
    btn.disabled = false;
    hint.textContent = `Signed in to LeetCode as @${res.username}.`;
  } else {
    btn.disabled = true;
    hint.innerHTML = 'Not signed into LeetCode — <a href="https://leetcode.com/accounts/login/" target="_blank">sign in</a>, then reload this page.';
  }
}

async function save() {
  const btn = $('#save');
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await doSave();
  } finally {
    btn.disabled = false;
  }
}

async function doSave() {
  const ladder = $('#ladder').value
    .split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
  const patch = {
    dailyQuota: num($('#quota').value, 1),
    splitReviewQuota: $('#split-quota').checked,
    newSolveQuota: num($('#new-solve-quota').value, 1),
    reviewQuota: num($('#review-quota').value, 0),
    intervalLadder: ladder.length ? ladder : DEFAULT_SETTINGS.intervalLadder,
    blocklist: settings.blocklist,
    overrideEnabled: $('#override-enabled').checked,
    overrideCountPerDay: num($('#override-count').value, 1),
    overrideDurationMin: num($('#override-duration').value, 10),
    overridePhrase: $('#override-phrase').value || 'the quick brown fox jumps over the lazy dog',
    quotaResetHour: num($('#reset-hour').value, 3)
  };
  const res = await send({ type: 'updateSettings', patch });
  if (res?.error) {
    await noticeDialog({ title: 'Save failed', body: res.error });
    return;
  }
  settings = await getSettings();
  await hydrate();
  $('#save-status').textContent = 'Saved';
  setTimeout(() => { $('#save-status').textContent = ''; }, 2000);
}

function send(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, res => {
      if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
      else resolve(res);
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
