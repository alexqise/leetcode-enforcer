// Variant 1 — Linear Dark Refined
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const STATUS_ORDER     = ['Active', 'Mastered', 'Archived'];
const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

const state = {
  problems: [],
  filtered: [],
  sort: { key: 'lastReviewed', dir: 'desc' },
  search: '',
  // empty set = no filter applied in that category (show all)
  // non-empty set = only show items matching one of the selected values
  filters: {
    status:     new Set(),
    difficulty: new Set(),
    topics:     new Set()
  },
  density: 'compact',
  showFilters: false,
  topicCounts: {}
};

init().catch(err => {
  console.error('[viewer1] init failed', err);
  $('#rows').innerHTML = `<tr class="empty-row"><td colspan="11"><div class="empty"><h2>Init failed</h2><p>${esc(err.message || err)}</p></div></td></tr>`;
});

async function init() {
  await load();
  buildFilters();
  applyFilters();
  render();
  wire();
}

async function load() {
  const { problems = {} } = await chrome.storage.local.get('problems');
  state.problems = Object.entries(problems).map(([slug, p]) => ({
    slug,
    number:           Number.isFinite(p.number) ? p.number : null,
    title:            p.title || slug,
    url:              p.url || `https://leetcode.com/problems/${slug}/`,
    difficulty:       p.difficulty || 'Unknown',
    topics:           Array.isArray(p.topics) ? p.topics : [],
    firstSolved:      p.firstSolved || null,
    lastReviewed:     p.lastReviewed || null,
    timesReviewed:    p.timesReviewed || 0,
    srsIntervalDays:  p.srsIntervalDays || 0,
    nextDue:          computeNextDue(p.lastReviewed, p.srsIntervalDays),
    status:           p.status || 'Active',
    latestConfidence: typeof p.latestConfidence === 'number' ? p.latestConfidence : null,
    notes:            p.notes || ''
  }));
  state.topicCounts = {};
  for (const p of state.problems) for (const t of p.topics) state.topicCounts[t] = (state.topicCounts[t] || 0) + 1;
}

function computeNextDue(last, days) {
  if (!last || !days) return null;
  const d = new Date(last); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function applyFilters() {
  let rows = state.problems;
  const q = state.search.trim().toLowerCase();
  if (q) rows = rows.filter(p =>
    p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || String(p.number || '').includes(q));
  rows = rows.filter(p => {
    if (state.filters.status.size > 0 && !state.filters.status.has(p.status)) return false;
    if (state.filters.difficulty.size > 0 && p.difficulty !== 'Unknown' && !state.filters.difficulty.has(p.difficulty)) return false;
    if (state.filters.topics.size > 0 && !p.topics.some(t => state.filters.topics.has(t))) return false;
    return true;
  });
  const { key, dir } = state.sort, m = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => cmp(a, b, key) * m);
  state.filtered = rows;
}

function cmp(a, b, key) {
  const av = a[key], bv = b[key];
  if ((av == null || av === '') && (bv == null || bv === '')) return 0;
  if (av == null || av === '') return 1;
  if (bv == null || bv === '') return -1;
  if (key === 'difficulty') return DIFFICULTY_ORDER.indexOf(av) - DIFFICULTY_ORDER.indexOf(bv);
  if (key === 'status') return STATUS_ORDER.indexOf(av) - STATUS_ORDER.indexOf(bv);
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av).localeCompare(String(bv));
}

function render() {
  // Preserve scroll position across re-renders (filter / sort)
  const tw = $('#table-wrap');
  const savedScroll = tw ? tw.scrollTop : 0;

  $('#count').textContent = `${state.filtered.length} / ${state.problems.length}`;
  renderStatusBar();
  const tbody = $('#rows');
  if (state.filtered.length === 0) {
    tbody.innerHTML = state.problems.length === 0 ? emptyState() : noMatchesState();
  } else {
    tbody.innerHTML = state.filtered.map(renderRow).join('');
  }
  $$('thead th').forEach(th => th.removeAttribute('data-sorted'));
  const th = $(`thead th[data-sort="${state.sort.key}"]`);
  if (th) th.setAttribute('data-sorted', state.sort.dir);
  document.body.classList.toggle('dense', state.density === 'compact');
  $('#density-label').textContent = state.density === 'compact' ? 'Compact' : 'Default';

  // Restore scroll position. If new content is shorter, browser clamps to max naturally.
  if (tw) tw.scrollTop = savedScroll;
}

function renderStatusBar() {
  const today = todayISO();
  const due = state.filtered.filter(p => p.nextDue && p.nextDue <= today && p.status === 'Active').length;
  const over = state.filtered.filter(p => p.nextDue && p.nextDue < today && p.status === 'Active').length;
  const mast = state.filtered.filter(p => p.status === 'Mastered').length;
  const act = state.filtered.filter(p => p.status === 'Active').length;

  $('#status-left').innerHTML = `
    <span class="stat-dot due"><strong>${due}</strong> due</span>
    <span class="stat-dot over"><strong>${over}</strong> overdue</span>
    <span class="stat-dot active"><strong>${act}</strong> active</span>
    <span class="stat-dot mastered"><strong>${mast}</strong> mastered</span>`;
  $('#status-right').innerHTML = `
    <span>Sorted by <strong>${state.sort.key}</strong> · ${state.sort.dir}</span>`;
}

function renderRow(p) {
  const today = todayISO();
  let dueCls = 'future';
  if (p.nextDue) {
    if (p.nextDue < today) dueCls = 'overdue';
    else if (p.nextDue === today) dueCls = 'due-today';
  }
  return `<tr>
    <td class="col-num">${p.number ?? '·'}</td>
    <td class="col-title"><a href="${esc(p.url)}" target="_blank" rel="noopener" title="${esc(p.title)}"><span class="title-text">${esc(p.title)}</span><span class="ext">↗</span></a></td>
    <td>${p.difficulty !== 'Unknown' ? `<span class="diff diff-${esc(p.difficulty)}">${esc(p.difficulty)}</span>` : '<span class="muted">—</span>'}</td>
    <td>${renderTopics(p.topics)}</td>
    <td>${renderStatus(p.status)}</td>
    <td class="col-conf">${renderConf(p.latestConfidence)}</td>
    <td class="col-notes">${renderNotes(p.notes)}</td>
    <td class="col-date date">${p.firstSolved ? esc(p.firstSolved) : '<span class="muted">—</span>'}</td>
    <td class="col-date date">${p.lastReviewed ? esc(p.lastReviewed) : '<span class="muted">—</span>'}</td>
    <td class="col-date date ${dueCls}">${p.nextDue ? esc(p.nextDue) : '<span class="muted">—</span>'}</td>
    <td class="col-int interval">${p.srsIntervalDays ? p.srsIntervalDays + 'd' : '<span class="muted">—</span>'}</td>
  </tr>`;
}

function renderTopics(t) {
  if (!t.length) return '<span class="muted">—</span>';
  const show = t.slice(0, 3), extra = t.length - show.length;
  const all = t.map(x => `<span class="topic">${esc(x)}</span>`).join('');
  const collapsed = show.map(x => `<span class="topic">${esc(x)}</span>`).join('');
  return `<div class="topics" data-collapsed-html="${esc(collapsed + (extra > 0 ? `<span class=\"topic more\" data-action=\"expand\">+${extra}</span>` : ''))}" data-expanded-html="${esc(all + (extra > 0 ? `<span class=\"topic more\" data-action=\"collapse\">collapse</span>` : ''))}">${collapsed}${extra > 0 ? `<span class="topic more" data-action="expand">+${extra}</span>` : ''}</div>`;
}

function renderStatus(s) {
  const ic = s === 'Mastered' ? '★' : s === 'Active' ? '●' : '◌';
  return `<span class="status status-${esc(s)}"><span class="status-icon">${ic}</span>${esc(s)}</span>`;
}

function renderConf(n) {
  if (n == null) return '<span class="muted">—</span>';
  const lvl = Math.max(1, Math.min(5, n));
  let segs = '';
  for (let i = 1; i <= 5; i++) segs += `<span class="seg ${i <= n ? 'on' : ''}"></span>`;
  return `<span class="conf" data-lvl="${lvl}">${segs}</span>`;
}

function renderNotes(notes) {
  if (!notes) return '<span class="muted">—</span>';
  return `<div class="notes" data-full="${esc(notes)}" title="Click to expand"><span class="notes-text">${esc(notes)}</span></div>`;
}

function emptyState() {
  return `<tr class="empty-row"><td colspan="11"><div class="empty"><h2>No problems tracked</h2><p>Solve a problem on leetcode.com and it'll appear here.</p></div></td></tr>`;
}
function noMatchesState() {
  return `<tr class="empty-row"><td colspan="11"><div class="empty"><h2>No matches</h2><p>Clear filters or try a different search.</p></div></td></tr>`;
}

function buildFilters() {
  const root = $('#filters');
  const topics = Object.entries(state.topicCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  root.innerHTML = `
    <div class="filter-section">
      <h3>Status</h3>
      <div class="chips" data-filter="status">${STATUS_ORDER.map(s => chip('status', s, s, count('status', s))).join('')}</div>
    </div>
    <div class="filter-section">
      <h3>Difficulty</h3>
      <div class="chips" data-filter="difficulty">${DIFFICULTY_ORDER.map(d => chip('difficulty', d, d, count('difficulty', d))).join('')}</div>
    </div>
    <div class="filter-section">
      <h3>Topics <span style="float:right;color:var(--fg-4);font-weight:400">${topics.length}</span></h3>
      <div class="chips" data-filter="topics">${topics.map(([t, c]) => chip('topics', t, t, c)).join('')}</div>
    </div>`;
  updateFilterBadge();
}

function chip(f, v, label, c) {
  const set = state.filters[f];
  const on = set.has(v);
  const inactive = set.size > 0 && !on;
  const cls = on ? 'on' : (inactive ? 'inactive' : '');
  return `<span class="chip ${cls}" data-filter="${esc(f)}" data-value="${esc(v)}">${esc(label)}<span class="chip-count">${c}</span></span>`;
}
function count(field, val) { return state.problems.filter(p => p[field] === val).length; }
function updateFilterBadge() {
  const n = state.filters.status.size + state.filters.difficulty.size + state.filters.topics.size;
  const b = $('#filter-count'); if (n > 0) { b.hidden = false; b.textContent = n; } else b.hidden = true;
}

function wire() {
  let st;
  $('#search').addEventListener('input', e => {
    clearTimeout(st);
    st = setTimeout(() => { state.search = e.target.value; applyFilters(); render(); }, 80);
  });
  $$('thead th').forEach(th => {
    if (!th.dataset.sort) return;
    th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (state.sort.key === k) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort.key = k; state.sort.dir = 'asc'; }
      applyFilters(); render();
    });
  });
  $('#toggle-density').addEventListener('click', () => {
    state.density = state.density === 'compact' ? 'default' : 'compact';
    render();
  });
  $('#toggle-filters').addEventListener('click', () => {
    state.showFilters = !state.showFilters;
    $('#filters').hidden = !state.showFilters;
    $('#toggle-filters').classList.toggle('active', state.showFilters);
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); $('#search').focus(); $('#search').select();
    }
    if (e.key === 'Escape' && document.activeElement === $('#search')) {
      $('#search').value = ''; state.search = ''; applyFilters(); render(); $('#search').blur();
    }
  });
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !changes.problems) return;
    await load(); buildFilters(); applyFilters(); render();
  });

  // Filter chip clicks — delegated on document so they survive any rebuild
  document.addEventListener('click', e => {
    const c = e.target.closest('.chip[data-filter]');
    if (!c) return;
    const f = c.dataset.filter, v = c.dataset.value, set = state.filters[f];
    if (!set) return;
    set.has(v) ? set.delete(v) : set.add(v);
    // Refresh all chips in this category to reflect on/inactive states
    $$(`#filters .chip[data-filter="${f}"]`).forEach(ch => {
      const val = ch.dataset.value;
      const isOn = set.has(val);
      const isInactive = set.size > 0 && !isOn;
      ch.classList.toggle('on', isOn);
      ch.classList.toggle('inactive', isInactive);
    });
    applyFilters(); render(); updateFilterBadge();
  });

  // Topics +N expand / collapse — delegated on document
  document.addEventListener('click', e => {
    const m = e.target.closest('.topic.more[data-action]');
    if (!m) return;
    const wrap = m.closest('.topics');
    if (!wrap) return;
    if (m.dataset.action === 'expand') {
      wrap.innerHTML = wrap.dataset.expandedHtml;
      wrap.classList.add('expanded');
    } else {
      wrap.innerHTML = wrap.dataset.collapsedHtml;
      wrap.classList.remove('expanded');
    }
  });

  // Notes click to expand/collapse — delegated on document
  document.addEventListener('click', e => {
    const n = e.target.closest('.notes');
    if (!n) return;
    n.classList.toggle('expanded');
  });
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function sendMsg(m) {
  return new Promise(res => chrome.runtime.sendMessage(m, r => {
    if (chrome.runtime.lastError) res({ error: chrome.runtime.lastError.message });
    else res(r);
  }));
}
