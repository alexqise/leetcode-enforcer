(() => {
  if (window.__lceInjected) return;
  window.__lceInjected = true;
  console.log('[LCE/inject] loaded in MAIN world');

  let lastSubmit = null;
  let watchUntil = 0;

  const SUBMIT_URL_RE = /\/problems\/[^/]+\/submit\/?($|\?)/;
  const CHECK_URL_RE = /\/submissions\/detail\/\d+\/check\//;
  const GRAPHQL_RE = /\/graphql\/?$/;
  const INTEREST_RE = /submit|check|submission|graphql|result|detail|verdict/i;

  const origFetch = window.fetch;
  window.fetch = async function patchedFetch(...args) {
    const reqUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const reqMethod = (args[1]?.method || (args[0] && typeof args[0] !== 'string' ? args[0].method : 'GET')).toUpperCase();
    const reqBody = args[1]?.body ? String(args[1].body) : '';

    if (SUBMIT_URL_RE.test(reqUrl) && reqMethod === 'POST') {
      try {
        const parsed = JSON.parse(reqBody);
        const slugMatch = reqUrl.match(/\/problems\/([^/]+)\//);
        lastSubmit = {
          slug: slugMatch ? slugMatch[1] : null,
          lang: parsed.lang,
          questionId: parsed.question_id,
          code: parsed.typed_code,
          submittedAt: Date.now()
        };
        watchUntil = Date.now() + 30000;
        console.log('[LCE/inject] captured submit body', { slug: lastSubmit.slug, lang: lastSubmit.lang });
      } catch (e) { console.warn('[LCE/inject] submit body parse failed', e); }
    }

    const res = await origFetch.apply(this, args);

    if (Date.now() < watchUntil && INTEREST_RE.test(reqUrl + ' ' + reqBody.slice(0, 200))) {
      console.log('[LCE/inject] post-submit fetch', { reqMethod, reqUrl, bodySnippet: reqBody.slice(0, 200) });
      try {
        const clone = res.clone();
        clone.text().then(t => {
          const snippet = t.slice(0, 400);
          console.log('[LCE/inject] response snippet for', reqUrl, snippet);
          maybeHandleAccepted(t, reqUrl);
        }).catch(() => {});
      } catch {}
    }

    try {
      const looksLikeCheck = CHECK_URL_RE.test(reqUrl);
      const looksLikeGraphQL = GRAPHQL_RE.test(reqUrl)
        && /submission|checkSubmission|submissionResult|submitSubmission/i.test(reqBody);

      if (looksLikeCheck || looksLikeGraphQL) {
        const clone = res.clone();
        clone.json().then(data => {
          const result = extractResult(data);
          console.log('[LCE/inject] check response', { url: reqUrl, statusMsg: result?.statusMsg, state: result?.state });
          if (result && (result.statusMsg === 'Accepted' || result.state === 'SUCCESS' && result.statusMsg === 'Accepted')) {
            const codeBundle = lastSubmit && (Date.now() - lastSubmit.submittedAt < 60000)
              ? { code: lastSubmit.code, lang: lastSubmit.lang, slug: lastSubmit.slug }
              : {};
            console.log('[LCE/inject] posting accepted event');
            window.postMessage({ source: 'lce-detector', event: 'accepted', payload: { ...result, ...codeBundle } }, '*');
          }
        }).catch((e) => console.warn('[LCE/inject] response parse failed', e));
      }
    } catch (e) { console.warn('[LCE/inject] check handler error', e); }
    return res;
  };

  function maybeHandleAccepted(text, url) {
    try {
      const data = JSON.parse(text);
      const result = extractResult(data);
      if (result && result.statusMsg === 'Accepted') {
        const codeBundle = lastSubmit && (Date.now() - lastSubmit.submittedAt < 60000)
          ? { code: lastSubmit.code, lang: lastSubmit.lang, slug: lastSubmit.slug }
          : {};
        console.log('[LCE/inject] generic-detection: posting accepted event from', url);
        window.postMessage({ source: 'lce-detector', event: 'accepted', payload: { ...result, ...codeBundle } }, '*');
        watchUntil = 0;
      }
    } catch {}
  }

  function extractResult(data) {
    if (!data) return null;
    if (data.status_msg) {
      return {
        statusMsg: data.status_msg, state: data.state, questionId: data.question_id,
        runtime: data.status_runtime, memory: data.status_memory, lang: data.lang
      };
    }
    const sub = data?.data?.submissionDetails || data?.submissionDetails
      || data?.data?.submitSubmission || data?.data?.submissionResult;
    if (sub) {
      return {
        statusMsg: sub.statusDisplay || sub.statusMsg || sub.status_msg,
        state: sub.state, questionId: sub.questionId,
        runtime: sub.runtimeDisplay, memory: sub.memoryDisplay,
        lang: sub.lang?.name || sub.lang
      };
    }
    return null;
  }
})();
