import { getSettings, setSettings, DEFAULT_SETTINGS } from '../lib/storage.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

let settings = { ...DEFAULT_SETTINGS };
let blocklist = [...DEFAULT_SETTINGS.blocklist];

init();

async function init() {
  settings = await getSettings();
  blocklist = [...(settings.blocklist || DEFAULT_SETTINGS.blocklist)];
  renderBlockGrid();
  $('#quota').value = settings.dailyQuota;
  $('#quota-val').textContent = settings.dailyQuota;
  if (settings.sheetId) {
    $('#connect-status').textContent = '✓ Already connected';
    $('#connect').textContent = 'Continue';
  }
  wire();
}

function wire() {
  $('#connect').addEventListener('click', async () => {
    $('#connect-status').textContent = 'Connecting…';
    if (!settings.sheetId) {
      const res = await send({ type: 'connectGoogle' });
      if (res.error) {
        $('#connect-status').textContent = '✗ ' + res.error;
        return;
      }
      $('#connect-status').textContent = '✓ Connected & spreadsheet created';
    }
    goto(2);
  });
  $('#skip-1').addEventListener('click', () => goto(2));

  $('#quota').addEventListener('input', (e) => {
    $('#quota-val').textContent = e.target.value;
  });
  $('#back-2').addEventListener('click', () => goto(1));
  $('#next-2').addEventListener('click', () => {
    setSettings({ dailyQuota: parseInt($('#quota').value, 10) });
    goto(3);
  });

  $('#back-3').addEventListener('click', () => goto(2));
  $('#add-site-btn').addEventListener('click', addSite);
  $('#add-site').addEventListener('keydown', e => { if (e.key === 'Enter') addSite(); });
  $('#finish').addEventListener('click', async () => {
    const enabled = [...$$('.block-item input:checked')].map(i => i.dataset.site);
    await send({
      type: 'updateSettings',
      patch: { blocklist: enabled, dailyQuota: parseInt($('#quota').value, 10) }
    });
    const state = await chrome.storage.local.get('state');
    await chrome.storage.local.set({ state: { ...(state.state || {}), installComplete: true } });
    goto('done');
  });

  $('#open-leetcode').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://leetcode.com/problemset/' });
  });
  $('#import-history').addEventListener('click', async (e) => {
    e.target.disabled = true;
    $('#import-status').textContent = 'Importing your LeetCode history…';
    const res = await send({ type: 'importLeetcodeHistory' });
    if (res.error) {
      $('#import-status').textContent = '✗ ' + res.error;
      e.target.disabled = false;
    } else {
      $('#import-status').textContent = `✓ Imported ${res.imported} problems as Mastered. You can un-master from the popup later.`;
    }
  });

  $('#gh-connect').addEventListener('click', async (e) => {
    const token = $('#gh-token').value.trim();
    const repoName = $('#gh-repo').value.trim() || 'leetcode-enforcer-solutions';
    if (!token) { $('#gh-status').textContent = 'Paste a token first.'; return; }
    e.target.disabled = true;
    $('#gh-status').textContent = 'Connecting…';
    const res = await send({ type: 'connectGithub', token, repoName });
    e.target.disabled = false;
    if (!res.ok) {
      $('#gh-status').textContent = '✗ ' + res.error;
    } else {
      $('#gh-token').value = '';
      $('#gh-status').innerHTML = `✓ Connected · <a href="${res.url}" target="_blank">${res.owner}/${res.repo}</a>`;
    }
  });
}

function goto(step) {
  $$('.step').forEach(s => { s.hidden = String(s.dataset.step) !== String(step); });
  $$('.dot').forEach(d => {
    const n = parseInt(d.dataset.step, 10);
    d.classList.toggle('active', step === 'done' || n <= (typeof step === 'number' ? step : 3));
  });
}

function renderBlockGrid() {
  const grid = $('#block-grid');
  grid.innerHTML = '';
  for (const d of blocklist) {
    const row = document.createElement('label');
    row.className = 'block-item';
    row.innerHTML = `
      <input type="checkbox" data-site="${escapeHtml(d)}" checked>
      <span>${escapeHtml(d)}</span>
      <button class="remove" title="Remove" type="button">✕</button>
    `;
    row.querySelector('.remove').addEventListener('click', (e) => {
      e.preventDefault();
      blocklist = blocklist.filter(x => x !== d);
      renderBlockGrid();
    });
    grid.appendChild(row);
  }
}

function addSite() {
  const v = $('#add-site').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!v || blocklist.includes(v)) return;
  blocklist.push(v);
  $('#add-site').value = '';
  renderBlockGrid();
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
