const $ = sel => document.querySelector(sel);

init();

async function init() {
  const status = await send({ type: 'getStatus' });
  if (!status || status.error) {
    renderUnavailable();
    return;
  }
  render(status);
  wireOverride(status.settings);
  showFrom();
  await loadSuggestions();
}

function renderUnavailable() {
  document.body.textContent = '';
  const msg = document.createElement('div');
  msg.className = 'unavailable';
  msg.textContent = 'LeetCode Enforcer is unavailable. Reload the page; if that fails, reload the extension from chrome://extensions.';
  document.body.appendChild(msg);
}

function render({ settings, state, due }) {
  const quota = Math.max(1, settings.dailyQuota);
  const solved = state.solvesToday;
  const remaining = Math.max(0, settings.dailyQuota - solved);

  $('#needed-num').textContent = remaining;
  $('#needed-label').textContent =
    remaining === 0 ? 'quota met'
    : remaining === 1 ? 'problem left today'
    : 'problems left today';
  $('#progress-sub').textContent = `${solved} of ${settings.dailyQuota} solved`;
  $('#reset-note').textContent = `resets ${String(settings.quotaResetHour ?? 3).padStart(2, '0')}:00`;

  const hero = document.querySelector('.hero');
  hero.classList.toggle('work-done', remaining === 0);

  const bar = $('#bar');
  bar.textContent = '';
  bar.setAttribute('aria-valuemax', quota);
  bar.setAttribute('aria-valuenow', Math.min(solved, quota));
  bar.setAttribute('aria-valuetext', `${solved} of ${settings.dailyQuota} solved`);
  for (let i = 0; i < quota; i++) {
    const seg = document.createElement('div');
    seg.className = 'bar-seg';
    if (i < solved) seg.classList.add('on');
    else if (i === solved && remaining > 0) seg.classList.add('next');
    bar.appendChild(seg);
  }

  const days = state.streakDays || 0;
  const streakText = $('.streak-text');
  streakText.textContent = '';
  const num = document.createElement('span');
  num.id = 'streak-num';
  num.textContent = days;
  streakText.append(num, '-day streak');

  const dueList = $('#due-list');
  dueList.textContent = '';
  const top = (due || []).slice(0, 3);
  if (top.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'due-empty';
    empty.textContent = 'No reviews due today.';
    dueList.appendChild(empty);
  } else {
    for (const p of top) {
      const row = document.createElement('div');
      row.className = 'due-row';
      const dot = document.createElement('span');
      dot.className = `due-dot ${(p.difficulty || '').toLowerCase()}`;
      const a = document.createElement('a');
      a.href = p.url; a.target = '_top';
      a.textContent = `${p.number ? p.number + '. ' : ''}${p.title}`;
      a.title = a.textContent;
      const meta = document.createElement('span');
      meta.className = 'due-meta';
      const diff = document.createElement('span');
      diff.className = `diff ${(p.difficulty || '').toLowerCase()}`;
      diff.textContent = p.difficulty;
      meta.append(diff, ` · ${p.srsIntervalDays}d`);
      row.append(dot, a, meta);
      dueList.appendChild(row);
    }
  }

  const overridesLeft = (settings.overrideCountPerDay || 0) - (state.overrideUsedToday || 0);
  $('#override-hint').textContent = !settings.overrideEnabled
    ? 'Override disabled in settings.'
    : overridesLeft <= 0
      ? 'No uses left today.'
      : `${overridesLeft} use${overridesLeft === 1 ? '' : 's'} left today · ${settings.overrideDurationMin} minutes`;
  $('#override-btn').disabled = !settings.overrideEnabled || overridesLeft <= 0;
}

async function loadSuggestions() {
  const [daily, random] = await Promise.all([
    send({ type: 'fetchDailyChallenge' }),
    send({ type: 'getRandomUnsolved' })
  ]);

  if (daily && !daily.error) {
    $('#daily-title').textContent = `${daily.number}. ${daily.title}`;
    setMeta($('#daily-meta'), daily.difficulty, daily.topics);
    $('#daily-card').href = daily.url;
  } else {
    $('#daily-title').textContent = "Can't reach LeetCode";
    $('#daily-meta').textContent = 'Sign in to leetcode.com, then reload this page.';
    $('#daily-card').href = 'https://leetcode.com/problemset/';
  }

  const link = $('#random-link');
  if (random && !random.error) {
    link.textContent = '';
    const tail = spaced('alt-diff alt-tail', ` · ${random.difficulty} `);
    tail.appendChild(arrowIcon());
    link.append(`${random.number}. ${random.title}`, tail);
    link.href = random.url;
  } else {
    $('#random-lead').textContent = 'or';
    link.textContent = '';
    const tail = spaced('alt-tail', 'set ');
    tail.appendChild(arrowIcon());
    link.append('browse the problem ', tail);
    link.href = 'https://leetcode.com/problemset/';
  }
}

function setMeta(el, difficulty, topics) {
  el.textContent = '';
  const diff = document.createElement('span');
  diff.className = `diff ${(difficulty || '').toLowerCase()}`;
  diff.textContent = difficulty;
  el.appendChild(diff);
  if (topics?.length) el.append(` · ${topics.slice(0, 3).join(', ')}`);
}

function spaced(cls, text) {
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  return s;
}

function arrowIcon() {
  const t = document.createElement('template');
  t.innerHTML = '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M4.5 11.5L11.5 4.5M5.75 4.5h5.75v5.75" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return t.content.firstChild;
}

function wireOverride(settings) {
  const modal = $('#override-modal');
  const openBtn = $('#override-btn');
  const confirmBtn = $('#override-confirm');
  const input = $('#phrase-input');
  const phrase = settings.overridePhrase || 'the quick brown fox jumps over the lazy dog';
  $('#phrase-required').textContent = phrase;
  $('#modal-mins').textContent = settings.overrideDurationMin || 10;

  function open() {
    $('#override-err').textContent = '';
    input.value = '';
    modal.hidden = false;
    input.focus();
  }
  function close() {
    modal.hidden = true;
    openBtn.focus();
  }

  openBtn.addEventListener('click', open);
  $('#override-cancel').addEventListener('click', close);
  confirmBtn.addEventListener('click', confirmOverride);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmOverride();
  });

  async function confirmOverride() {
    const typed = input.value;
    if (typed !== phrase) {
      $('#override-err').textContent = 'Phrase must match exactly.';
      return;
    }
    confirmBtn.disabled = true;
    const res = await send({ type: 'startOverride', phrase: typed });
    confirmBtn.disabled = false;
    if (res.error || !res.ok) {
      $('#override-err').textContent = res.error || 'Override failed.';
      return;
    }
    const from = new URLSearchParams(location.search).get('from');
    if (from) location.replace(decodeURIComponent(from));
    else location.replace('https://www.google.com');
  }
}

function showFrom() {
  const from = new URLSearchParams(location.search).get('from');
  if (!from) return;
  try {
    const u = new URL(decodeURIComponent(from));
    $('#from-line').hidden = false;
    $('#from-url').textContent = u.host;
  } catch {}
}

function send(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, res => {
      if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
      else resolve(res);
    });
  });
}
