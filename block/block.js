const $ = sel => document.querySelector(sel);

init();

async function init() {
  const status = await send({ type: 'getStatus' });
  if (!status || status.error) {
    document.body.innerText = 'LeetCode Enforcer unavailable.';
    return;
  }
  render(status);
  await loadSuggestions();
  wireOverride(status.settings);
  showFrom();
}

function render({ settings, state, due }) {
  const remaining = Math.max(0, settings.dailyQuota - state.solvesToday);
  $('#needed-num').textContent = remaining;
  $('#needed-label').textContent = remaining === 1 ? 'problem left today' : 'problems left today';
  const pct = Math.min(100, Math.round(100 * state.solvesToday / Math.max(1, settings.dailyQuota)));
  $('#bar-fill').style.width = pct + '%';
  $('#progress-sub').textContent = `${state.solvesToday} of ${settings.dailyQuota} solved`;
  $('#streak').textContent = `🔥 ${state.streakDays || 0} day${(state.streakDays === 1) ? '' : 's'}`;

  const dueList = $('#due-list');
  dueList.innerHTML = '';
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
      const a = document.createElement('a');
      a.href = p.url; a.target = '_top';
      a.textContent = `${p.number ? p.number + '. ' : ''}${p.title}`;
      const meta = document.createElement('span');
      meta.className = 'due-meta';
      meta.textContent = `${p.difficulty} · ${p.srsIntervalDays}d`;
      row.appendChild(a); row.appendChild(meta);
      dueList.appendChild(row);
    }
  }

  const overridesLeft = (settings.overrideCountPerDay || 0) - (state.overrideUsedToday || 0);
  $('#override-hint').textContent = settings.overrideEnabled
    ? `${overridesLeft} use${overridesLeft === 1 ? '' : 's'} left today · ${settings.overrideDurationMin} minutes`
    : 'Override disabled';
  $('#override-btn').disabled = !settings.overrideEnabled || overridesLeft <= 0;
}

async function loadSuggestions() {
  const [daily, random] = await Promise.all([
    send({ type: 'fetchDailyChallenge' }),
    send({ type: 'getRandomUnsolved' })
  ]);
  if (daily && !daily.error) {
    $('#daily-title').textContent = `${daily.number}. ${daily.title}`;
    $('#daily-meta').textContent = `${daily.difficulty}${daily.topics?.length ? ' · ' + daily.topics.slice(0,3).join(', ') : ''}`;
    $('#daily-cta').href = daily.url;
  } else {
    $('#daily-title').textContent = 'Unable to fetch';
    $('#daily-meta').textContent = 'Are you signed into LeetCode?';
    $('#daily-cta').href = 'https://leetcode.com/problemset/';
  }
  if (random && !random.error) {
    $('#random-title').textContent = `${random.number}. ${random.title}`;
    $('#random-meta').textContent = `${random.difficulty}${random.topics?.length ? ' · ' + random.topics.slice(0,3).join(', ') : ''}`;
    $('#random-cta').href = random.url;
  } else {
    $('#random-title').textContent = 'Browse problems';
    $('#random-meta').textContent = '';
    $('#random-cta').href = 'https://leetcode.com/problemset/';
  }
}

function wireOverride(settings) {
  const modal = $('#override-modal');
  const phrase = settings.overridePhrase || 'the quick brown fox jumps over the lazy dog';
  $('#phrase-required').textContent = phrase;

  $('#override-btn').addEventListener('click', () => {
    $('#override-err').textContent = '';
    $('#phrase-input').value = '';
    modal.hidden = false;
    setTimeout(() => $('#phrase-input').focus(), 50);
  });
  $('#override-cancel').addEventListener('click', () => { modal.hidden = true; });
  $('#override-confirm').addEventListener('click', confirmOverride);
  $('#phrase-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmOverride();
    if (e.key === 'Escape') { modal.hidden = true; }
  });

  async function confirmOverride() {
    const typed = $('#phrase-input').value;
    if (typed !== phrase) {
      $('#override-err').textContent = 'Phrase must match exactly.';
      return;
    }
    const res = await send({ type: 'startOverride', phrase: typed });
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
    $('#from-row').hidden = false;
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
