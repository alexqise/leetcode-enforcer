const $ = sel => document.querySelector(sel);

let picked = null;
let manualConfidence = null;

init();

async function init() {
  const auth = await send({ type: 'getAuthState' });
  if (!auth?.signedIn) {
    showAuthGate();
    return;
  }
  await render();
  wire();
}

function showAuthGate() {
  $('#auth-gate').hidden = false;
  $('#root').hidden = true;
  const btn = $('#auth-signin-btn');
  const label = $('#auth-signin-label');
  const err = $('#auth-error');
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    err.hidden = true;
    label.innerHTML = '<span class="spinner" aria-hidden="true"></span> Signing in…';
    const res = await send({ type: 'signInGoogle' });
    if (res?.ok) {
      $('#auth-gate').hidden = true;
      $('#root').hidden = false;
      await render();
      wire();
      await maybePromptHistoryImport();
    } else {
      btn.disabled = false;
      label.textContent = 'Continue with Google';
      err.hidden = false;
      err.textContent = 'Sign-in failed: ' + (res?.error || 'unknown');
    }
  });
}

async function render() {
  const status = await send({ type: 'getStatus' });
  if (!status || status.error) return;
  const { settings, state, due, blockActive } = status;

  $('#progress-text').textContent = `${state.solvesToday} / ${settings.dailyQuota}`;
  const pct = Math.min(100, Math.round(100 * state.solvesToday / Math.max(1, settings.dailyQuota)));
  $('#bar-fill').style.width = pct + '%';
  $('#streak-num').textContent = String(state.streakDays || 0);
  $('#block-state').textContent = blockActive
    ? 'Blocking is active.'
    : (state.overrideActiveUntil
      ? `Override active until ${new Date(state.overrideActiveUntil).toLocaleTimeString()}.`
      : 'Quota met — sites unblocked.');

  if (state.lastSyncError || state.lastGithubError) {
    $('#sync-err').hidden = false;
    const parts = [];
    if (state.lastSyncError) parts.push('Sync: ' + state.lastSyncError);
    if (state.lastGithubError) parts.push('GitHub: ' + state.lastGithubError);
    $('#sync-err-msg').textContent = parts.join(' · ');
  } else {
    $('#sync-err').hidden = true;
  }

  const dueEl = $('#due-list');
  dueEl.innerHTML = '';
  $('#due-count').textContent = String(due.length);
  if (due.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'due-empty';
    empty.textContent = 'Nothing due — you’re clear.';
    dueEl.appendChild(empty);
  } else {
    for (const p of due) {
      const row = document.createElement('div');
      row.className = 'due-row';
      const a = document.createElement('a');
      a.href = p.url; a.target = '_blank';
      a.textContent = `${p.number ? p.number + '. ' : ''}${p.title}`;
      a.className = 'due-title';
      const meta = document.createElement('span');
      meta.className = 'due-meta';
      meta.textContent = `${p.difficulty} · ${p.srsIntervalDays}d`;
      row.appendChild(a); row.appendChild(meta);
      dueEl.appendChild(row);
    }
  }

  const ICON_USER = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><circle cx="8" cy="5.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 13.5c.7-2 2.5-3 5-3s4.3 1 5 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const ICON_LOCK = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="3.5" y="6.5" width="9" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 6.5V4.5a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

  const authLink = $('#auth-action');
  const authIcon = $('#auth-icon-out');
  if (status.signedIn) {
    const label = status.user?.name || status.user?.email || 'Signed in';
    $('#auth-label').textContent = label;
    if (authIcon) authIcon.outerHTML = ICON_USER.replace('<svg', '<svg id="auth-icon-out"');
    authLink.onclick = async (e) => {
      e.preventDefault();
      if (!confirm('Sign out of Google? Local data stays.')) return;
      await send({ type: 'signOut' });
      await render();
    };
  } else {
    $('#auth-label').textContent = 'Sign in with Google';
    if (authIcon) authIcon.outerHTML = ICON_LOCK.replace('<svg', '<svg id="auth-icon-out"');
    authLink.onclick = async (e) => {
      e.preventDefault();
      const res = await send({ type: 'signInGoogle' });
      if (res?.ok) {
        await maybePromptHistoryImport();
      } else if (res?.error) {
        alert('Sign-in failed: ' + res.error);
      }
      await render();
    };
  }

  if (settings.githubEnabled && settings.githubRepoUrl) {
    $('#open-github').href = settings.githubRepoUrl;
    $('#open-github').onclick = null;
    $('#github-label').textContent = 'Open repo';
  } else {
    $('#open-github').href = '#';
    $('#github-label').textContent = 'Connect GitHub';
    $('#open-github').onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#github') });
    };
  }
}

async function maybePromptHistoryImport() {
  const { state = {} } = await chrome.storage.local.get('state');
  if (state.historyImportPrompted) return;
  const login = await send({ type: 'getLeetcodeLoginStatus' });
  if (!login?.isSignedIn) return;
  await chrome.storage.local.set({ state: { ...state, historyImportPrompted: true } });
  if (!confirm(`Connected. Pull your LeetCode history once (signed in as @${login.username}, marks all as Mastered)? You can also do this later from Settings.`)) return;
  const res = await send({ type: 'importLeetcodeHistory' });
  if (res?.error || res?.ok === false) {
    alert('History import failed: ' + (res?.error || 'unknown'));
  } else {
    alert(`Imported ${res.imported} problems.`);
  }
}

function wire() {
  $('#open-options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  });
  $('#open-viewer').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer1/viewer.html') });
  });
  $('#retry-sync').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    btn.disabled = true;
    btn.dataset.label = btn.textContent;
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
    btn.setAttribute('aria-busy', 'true');
    const res = await send({ type: 'retryLastSync' });
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
    btn.textContent = btn.dataset.label || 'Retry';
    await render();
    if (res?.ok === false) alert('Still failing: ' + res.error);
  });

  $('#manual-query').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.target.value = ''; $('#manual-results').innerHTML = ''; e.target.blur(); }
  });

  let searchTimer;
  $('#manual-query').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (!q) { $('#manual-results').innerHTML = ''; return; }
    searchTimer = setTimeout(async () => {
      const results = await send({ type: 'searchCatalog', query: q, limit: 8 });
      renderSearchResults(results || []);
    }, 180);
  });

  $('#manual-confidence').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    [...$('#manual-confidence').children].forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    manualConfidence = parseInt(btn.dataset.val, 10);
  });

  $('#manual-cancel').addEventListener('click', () => resetManualForm());
  $('#manual-save').addEventListener('click', async () => {
    if (!picked) return;
    const payload = {
      ...picked,
      confidence: manualConfidence,
      notes: $('#manual-notes').value.trim(),
      needReview: $('#manual-need').checked,
      mastered: $('#manual-master').checked
    };
    const res = await send({ type: 'manualEntry', payload });
    if (res.error) { alert('Save failed: ' + res.error); return; }
    resetManualForm();
    await render();
  });
}

function renderSearchResults(items) {
  const el = $('#manual-results');
  el.innerHTML = '';
  for (const p of items) {
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `<div><strong>${p.number}.</strong> ${escapeHtml(p.title)}</div>
      <div class="meta">${p.difficulty}${p.topics?.length ? ' · ' + p.topics.slice(0,3).join(', ') : ''}</div>`;
    row.addEventListener('click', () => choosePicked(p));
    el.appendChild(row);
  }
}

function choosePicked(p) {
  picked = p;
  $('#manual-results').innerHTML = '';
  $('#manual-query').value = '';
  $('#manual-picked').textContent = `${p.number}. ${p.title} — ${p.difficulty}`;
  $('#manual-form').hidden = false;
}

function resetManualForm() {
  picked = null; manualConfidence = null;
  $('#manual-picked').textContent = '';
  $('#manual-notes').value = '';
  $('#manual-need').checked = false;
  $('#manual-master').checked = false;
  [...$('#manual-confidence').children].forEach(c => c.classList.remove('active'));
  $('#manual-form').hidden = true;
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
