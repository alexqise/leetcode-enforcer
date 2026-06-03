(() => {
  if (window.__lceInjected) return;
  window.__lceInjected = true;

  const origFetch = window.fetch;
  window.fetch = async function patchedFetch(...args) {
    const res = await origFetch.apply(this, args);
    try {
      const reqUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      const reqBody = args[1]?.body ? String(args[1].body) : '';
      const isSubmissionResult =
        /\/submissions\/detail\/\d+\/check\//.test(reqUrl) ||
        (reqUrl.includes('/graphql') && /submissionResult|checkSubmission/.test(reqBody));

      if (isSubmissionResult) {
        const clone = res.clone();
        clone.json().then(data => {
          const result = extractResult(data);
          if (result && result.statusMsg === 'Accepted') {
            window.postMessage({
              source: 'lce-detector',
              event: 'accepted',
              payload: result
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
