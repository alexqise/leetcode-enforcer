(() => {
  if (window.__lceInjected) return;
  window.__lceInjected = true;

  let lastSubmit = null;

  const origFetch = window.fetch;
  window.fetch = async function patchedFetch(...args) {
    const reqUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const reqMethod = (args[1]?.method || 'GET').toUpperCase();
    const reqBody = args[1]?.body ? String(args[1].body) : '';

    if (reqMethod === 'POST' && /\/problems\/[^/]+\/submit\/?$/.test(reqUrl)) {
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
      } catch (e) { /* ignore */ }
    }

    const res = await origFetch.apply(this, args);

    try {
      const isSubmissionResult =
        /\/submissions\/detail\/\d+\/check\//.test(reqUrl) ||
        (reqUrl.includes('/graphql') && /submissionResult|checkSubmission/.test(reqBody));

      if (isSubmissionResult) {
        const clone = res.clone();
        clone.json().then(data => {
          const result = extractResult(data);
          if (result && result.statusMsg === 'Accepted') {
            const codeBundle = lastSubmit && (Date.now() - lastSubmit.submittedAt < 60000)
              ? { code: lastSubmit.code, lang: lastSubmit.lang, slug: lastSubmit.slug }
              : {};
            window.postMessage({
              source: 'lce-detector',
              event: 'accepted',
              payload: { ...result, ...codeBundle }
            }, '*');
          }
        }).catch(() => {});
      }
    } catch (e) { /* never break the page */ }
    return res;
  };

  function extractResult(data) {
    if (!data) return null;
    if (data.status_msg) {
      return {
        statusMsg: data.status_msg,
        state: data.state,
        questionId: data.question_id,
        runtime: data.status_runtime,
        memory: data.status_memory,
        lang: data.lang
      };
    }
    const sub = data?.data?.submissionDetails || data?.submissionDetails;
    if (sub) {
      return {
        statusMsg: sub.statusDisplay || sub.statusMsg,
        questionId: sub.questionId,
        runtime: sub.runtimeDisplay,
        memory: sub.memoryDisplay,
        lang: sub.lang?.name || sub.lang
      };
    }
    return null;
  }
})();
