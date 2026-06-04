(() => {
  let overlayHost = null;
  let bannerHost = null;
  let processedAt = 0;
  let lastAcceptedPayload = null;

  init();

  function init() {
    console.log('[LCE/content] loaded in ISOLATED world on', location.href);
    window.addEventListener('message', onMessage);
    setupBanner();

    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        setupBanner();
      }
    }, 1000);
  }

  function onMessage(evt) {
    if (evt.source !== window) return;
    const m = evt.data;
    if (!m || m.source !== 'lce-detector') return;
    if (m.event === 'accepted') {
      console.log('[LCE/content] received accepted event', m.payload);
      const now = Date.now();
      if (now - processedAt < 2000) return;
      processedAt = now;
      lastAcceptedPayload = m.payload || {};
      showRatingOverlay();
    }
  }

  function currentSlug() {
    const m = location.pathname.match(/^\/problems\/([^/]+)/);
    return m ? m[1] : null;
  }

  function readPageMeta() {
    const slug = currentSlug();
    if (!slug) return null;
    const number = guessNumber();
    const title = guessTitle(slug);
    const difficulty = guessDifficulty();
    const topics = guessTopics();
    return {
      slug, number, title,
      url: `https://leetcode.com/problems/${slug}/`,
      difficulty, topics
    };
  }

  function guessNumber() {
    const text = document.body.innerText || '';
    const m = text.match(/(\d+)\.\s+[A-Z]/);
    return m ? parseInt(m[1], 10) : null;
  }

  function guessTitle(slug) {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    if (ogTitle) return ogTitle.replace(/\s*-\s*LeetCode$/, '').trim();
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function guessDifficulty() {
    const txt = document.body.innerText || '';
    if (/\bHard\b/.test(txt.slice(0, 4000))) return 'Hard';
    if (/\bMedium\b/.test(txt.slice(0, 4000))) return 'Medium';
    if (/\bEasy\b/.test(txt.slice(0, 4000))) return 'Easy';
    return 'Unknown';
  }

  function guessTopics() {
    return [];
  }

  function showRatingOverlay() {
    const meta = readPageMeta();
    if (!meta) return;
    if (overlayHost) overlayHost.remove();

    overlayHost = document.createElement('div');
    overlayHost.id = 'lce-overlay-host';
    overlayHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(overlayHost);
    const shadow = overlayHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = overlayHTML(meta);
    wireOverlay(shadow, meta);
  }

  function overlayHTML(meta) {
    return `
      <style>
        :host { all: initial; }
        .backdrop {
          position: fixed; inset: 0; background: rgba(15,15,15,.55);
          display: flex; align-items: center; justify-content: center;
          pointer-events: auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .modal {
          background: #FBFBFA; color: #37352F; border-radius: 12px;
          width: min(480px, 92vw); padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,.35);
        }
        .title { font-size: 14px; opacity: .6; margin-bottom: 4px; }
        .name { font-size: 18px; font-weight: 600; margin-bottom: 18px; word-break: break-word; }
        .label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; opacity: .55; margin-bottom: 6px; }
        .segs { display: flex; gap: 6px; margin-bottom: 18px; }
        .seg {
          flex: 1; padding: 10px 0; border: 1px solid #E1E1DE; border-radius: 6px;
          background: white; cursor: pointer; font-size: 15px; font-weight: 500;
        }
        .seg.active { background: #37352F; color: white; border-color: #37352F; }
        textarea {
          width: 100%; min-height: 80px; resize: vertical; padding: 10px;
          border: 1px solid #E1E1DE; border-radius: 6px; box-sizing: border-box;
          font-family: inherit; font-size: 14px; margin-bottom: 18px;
          background: white; color: #37352F;
        }
        .toggles { display: flex; gap: 14px; margin-bottom: 18px; }
        .toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
        .toggle input { width: 16px; height: 16px; }
        .actions { display: flex; justify-content: space-between; gap: 8px; }
        button.primary {
          background: #37352F; color: white; border: 0; border-radius: 6px;
          padding: 10px 18px; font-weight: 600; cursor: pointer; font-size: 14px;
          display: inline-flex; align-items: center; gap: 6px;
        }
        button.primary:disabled, button.ghost:disabled { opacity: .5; cursor: not-allowed; }
        button.ghost {
          background: transparent; color: #37352F; border: 0;
          padding: 10px 14px; cursor: pointer; font-size: 14px;
        }
        .spinner {
          width: 12px; height: 12px;
          border: 2px solid currentColor; border-right-color: transparent;
          border-radius: 50%; display: inline-block;
          animation: lce-spin .7s linear infinite;
        }
        @keyframes lce-spin { to { transform: rotate(360deg); } }
      </style>
      <div class="backdrop">
        <div class="modal">
          <div class="title">Solved 🎉 — rate it</div>
          <div class="name">${escapeHtml(meta.title)}</div>

          <div class="label">Confidence</div>
          <div class="segs" data-group="confidence">
            ${[1,2,3,4,5].map(n => `<button class="seg" data-val="${n}">${n}</button>`).join('')}
          </div>

          <div class="label">Notes</div>
          <textarea placeholder="Key insight, gotcha, pattern…"></textarea>

          <div class="toggles">
            <label class="toggle"><input type="checkbox" data-id="needReview"> Need to review again</label>
            <label class="toggle"><input type="checkbox" data-id="mastered"> Mastered — don't review</label>
          </div>

          <div class="actions">
            <button class="ghost" data-act="skip">Skip for now</button>
            <button class="primary" data-act="save">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  function wireOverlay(shadow, meta) {
    let confidence = null;
    const segs = shadow.querySelectorAll('[data-group="confidence"] .seg');
    segs.forEach(s => s.addEventListener('click', () => {
      segs.forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      confidence = parseInt(s.dataset.val, 10);
    }));

    const saveBtn = shadow.querySelector('[data-act="save"]');
    const skipBtn = shadow.querySelector('[data-act="skip"]');
    const originalSaveLabel = saveBtn.textContent;

    saveBtn.addEventListener('click', async () => {
      if (saveBtn.disabled) return;
      const notes = shadow.querySelector('textarea').value.trim();
      const needReview = shadow.querySelector('[data-id="needReview"]').checked;
      const mastered = shadow.querySelector('[data-id="mastered"]').checked;

      saveBtn.disabled = true;
      skipBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner"></span>Saving…';

      try {
        const payload = {
          ...meta, confidence, notes, needReview, mastered,
          code: lastAcceptedPayload?.code || null,
          lang: lastAcceptedPayload?.lang || null
        };
        const enriched = await maybeEnrichMeta(payload);
        const res = await sendMessage({ type: 'recordSolve', payload: enriched });
        if (res?.error) {
          alert('LeetCode Enforcer: save failed — ' + res.error);
          saveBtn.disabled = false;
          skipBtn.disabled = false;
          saveBtn.textContent = originalSaveLabel;
          return;
        }
        destroyOverlay();
        maybeRefreshBanner();
      } catch (e) {
        alert('LeetCode Enforcer: save failed — ' + (e.message || e));
        saveBtn.disabled = false;
        skipBtn.disabled = false;
        saveBtn.textContent = originalSaveLabel;
      }
    });

    skipBtn.addEventListener('click', () => {
      if (skipBtn.disabled) return;
      destroyOverlay();
    });
  }

  async function maybeEnrichMeta(payload) {
    if (payload.difficulty !== 'Unknown' && payload.topics?.length) return payload;
    try {
      const meta = await sendMessage({ type: 'getProblemMeta', slug: payload.slug });
      if (meta && !meta.error) return { ...payload, ...meta };
    } catch {}
    return payload;
  }

  function destroyOverlay() {
    if (overlayHost) {
      overlayHost.remove();
      overlayHost = null;
    }
  }

  async function setupBanner() {
    if (bannerHost) { bannerHost.remove(); bannerHost = null; }
    try {
      const due = await sendMessage({ type: 'getDueProblems', limit: 5 });
      if (!Array.isArray(due) || due.length === 0) return;
      renderBanner(due);
    } catch {}
  }

  function renderBanner(due) {
    bannerHost = document.createElement('div');
    bannerHost.id = 'lce-banner-host';
    bannerHost.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483646;';
    document.documentElement.appendChild(bannerHost);
    const shadow = bannerHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .bar {
          background: #37352F; color: white; padding: 8px 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 13px; display: flex; align-items: center; gap: 12px;
        }
        .bar a { color: #FFCD3F; text-decoration: none; font-weight: 600; }
        .close { margin-left: auto; cursor: pointer; opacity: .7; padding: 0 4px; }
        .close:hover { opacity: 1; }
      </style>
      <div class="bar">
        <span>📚 ${due.length} review${due.length === 1 ? '' : 's'} due — </span>
        <a href="${due[0].url}">start with "${escapeHtml(due[0].title)}" →</a>
        <span class="close" title="Hide">✕</span>
      </div>
    `;
    shadow.querySelector('.close').addEventListener('click', () => {
      if (bannerHost) { bannerHost.remove(); bannerHost = null; }
    });
  }

  function maybeRefreshBanner() {
    setTimeout(setupBanner, 500);
  }

  function sendMessage(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
          else resolve(res);
        });
      } catch (e) { resolve({ error: e.message }); }
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
})();
