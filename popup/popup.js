const $ = sel => document.querySelector(sel);

let picked = null;
let manualConfidence = null;

init();

async function init() {
  await render();
  wire();
}

async function render() {
  const status = await send({ type: 'getStatus' });
  if (!status || status.error) return;
  const { settings, state, due, blockActive } = status;

  $('#progress-text').textContent = `${state.solvesToday} / ${settings.dailyQuota}`;
  const pct = Math.min(100, Math.round(100 * state.solvesToday / Math.max(1, settings.dailyQuota)));
  $('#bar-fill').style.width = pct + '%';
  $('#streak').textContent = `🔥 ${state.streakDays || 0}`;
  $('#block-state').textContent = blockActive
    ? 'Blocking is active.'
    : (state.overrideActiveUntil
      ? `Override active until ${new Date(state.overrideActiveUntil).toLocaleTimeString()}.`
      : 'Quota met — sites unblocked.');

  if (state.lastSyncError || state.lastGithubError) {
    $('#sync-err').hidden = false;
    const parts = [];
    if (state.lastSyncError) parts.push('Sheets: ' + state.lastSyncError);
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
    empty.textContent = 'Nothing due. 👍';
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

  if (settings.sheetUrl) {
    $('#open-sheet').href = settings.sheetUrl;
  } else {
    $('#open-sheet').textContent = '🔌 Connect Google Sheets';
    $('#open-sheet').onclick = async (e) => {
      e.preventDefault();
      const res = await send({ type: 'connectGoogle' });
      if (res.error) alert('Connect failed: ' + res.error);
      await render();
    };
  }
}

function wire() {
  $('#open-options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  $('#retry-sync').addEventListener('click', async () => {
    await send({ type: 'retryLastSync' });
    await render();
  });
  $('#import-history').addEventListener('click', async (e) => {
    e.preventDefault();
    e.target.textContent = '… importing';
    const res = await send({ type: 'importLeetcodeHistory' });
    if (res.error) {
      alert('Import failed: ' + res.error);
      e.target.textContent = '⤵ Import LC history';
    } else {
      e.target.textContent = `✓ Imported ${res.imported}`;
      setTimeout(() => { e.target.textContent = '⤵ Import LC history'; }, 3000);
    }
    await render();
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
