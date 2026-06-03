import { getSettings, setSettings, DEFAULT_SETTINGS } from '../lib/storage.js';

const $ = sel => document.querySelector(sel);
let settings = { ...DEFAULT_SETTINGS };

init();

async function init() {
  settings = await getSettings();
  hydrate();
  wire();
}

function hydrate() {
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
  $('#override-phrase').value = settings.overridePhrase ?? 'I am being weak';

  $('#reset-hour').value = settings.quotaResetHour ?? 3;

  renderBlocklist();

  if (settings.sheetUrl) {
    $('#sheet-status').textContent = 'Connected';
    $('#open-sheet-link').hidden = false;
    $('#open-sheet-link').href = settings.sheetUrl;
  } else {
    $('#sheet-status').textContent = 'Not connected';
    $('#open-sheet-link').hidden = true;
  }

  if (settings.githubEnabled && settings.githubToken) {
    $('#gh-disconnected').hidden = true;
    $('#gh-connected').hidden = false;
    $('#gh-login').textContent = settings.githubOwner || '?';
    $('#gh-repo-link').href = settings.githubRepoUrl || '#';
    const state = await chrome.storage.local.get('state').then(r => r.state || {});
    if (state.lastGithubCommitUrl) {
      $('#gh-last-commit').innerHTML = `Last commit: <a href="${state.lastGithubCommitUrl}" target="_blank">view</a>`;
    } else {
      $('#gh-last-commit').textContent = '';
    }
  } else {
    $('#gh-disconnected').hidden = false;
    $('#gh-connected').hidden = true;
    $('#gh-repo').value = settings.githubRepo || 'leetcode-enforcer-solutions';
  }
}

function renderBlocklist() {
  const el = $('#blocklist');
  el.innerHTML = '';
  for (const d of settings.blocklist) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `${escapeHtml(d)}<button title="Remove">×</button>`;
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

  $('#reconnect-sheet').addEventListener('click', async () => {
    const res = await send({ type: 'connectGoogle' });
    if (res.error) alert('Connect failed: ' + res.error);
    settings = await getSettings();
    hydrate();
  });

  $('#force-sync').addEventListener('click', async () => {
    const res = await send({ type: 'forceSyncAll' });
    alert(res.error ? 'Sync failed: ' + res.error : 'Synced.');
  });

  $('#reset-all').addEventListener('click', async () => {
    if (!confirm('Wipe ALL local data? This cannot be undone. The spreadsheet itself is not deleted.')) return;
    await send({ type: 'resetAll' });
    settings = { ...DEFAULT_SETTINGS };
    hydrate();
    alert('Reset complete.');
  });

  $('#save').addEventListener('click', save);

  $('#gh-connect').addEventListener('click', async () => {
    const token = $('#gh-token').value.trim();
    const repoName = $('#gh-repo').value.trim() || 'leetcode-enforcer-solutions';
    if (!token) { alert('Paste a GitHub PAT first.'); return; }
    $('#gh-connect').disabled = true;
    $('#gh-connect').textContent = 'Connecting…';
    const res = await send({ type: 'connectGithub', token, repoName });
    $('#gh-connect').disabled = false;
    $('#gh-connect').textContent = 'Connect GitHub';
    if (!res.ok) { alert('GitHub connect failed: ' + res.error); return; }
    $('#gh-token').value = '';
    settings = await getSettings();
    hydrate();
    alert(`Connected as ${res.owner}. Repo: ${res.repo}`);
  });
  $('#gh-disconnect').addEventListener('click', async () => {
    if (!confirm('Disconnect GitHub? Local PAT will be deleted. The repo and its contents are kept.')) return;
    await send({ type: 'disconnectGithub' });
    settings = await getSettings();
    hydrate();
  });
  $('#gh-test').addEventListener('click', async () => {
    const res = await send({ type: 'testGithub' });
    if (res.ok) alert('OK — connected as ' + res.login);
    else alert('Test failed: ' + res.error);
  });
}

function addSite() {
  const v = $('#add-site').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!v) return;
  if (settings.blocklist.includes(v)) return;
  settings.blocklist.push(v);
  $('#add-site').value = '';
  renderBlocklist();
}

async function save() {
  const ladder = $('#ladder').value
    .split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
  const patch = {
    dailyQuota: parseInt($('#quota').value, 10),
    splitReviewQuota: $('#split-quota').checked,
    newSolveQuota: parseInt($('#new-solve-quota').value, 10),
    reviewQuota: parseInt($('#review-quota').value, 10),
    intervalLadder: ladder.length ? ladder : DEFAULT_SETTINGS.intervalLadder,
    blocklist: settings.blocklist,
    overrideEnabled: $('#override-enabled').checked,
    overrideCountPerDay: parseInt($('#override-count').value, 10),
    overrideDurationMin: parseInt($('#override-duration').value, 10),
    overridePhrase: $('#override-phrase').value,
    quotaResetHour: parseInt($('#reset-hour').value, 10)
  };
  await send({ type: 'updateSettings', patch });
  settings = await getSettings();
  hydrate();
  $('#save-status').textContent = '✓ Saved';
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
