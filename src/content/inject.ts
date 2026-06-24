// MAIN-world fetch/XHR/WebSocket monkey-patch — verbatim port of v1
// content/leetcode_inject.js. This is the most fragile file in the
// extension (SPEC §3): typed minimally, structure unchanged. Do not
// refactor without re-verifying solve detection on leetcode.com.

declare global {
  interface Window {
    __lceInjected?: boolean
  }
}

interface LastSubmit {
  slug: string | null
  lang: string
  questionId: string
  code: string
  submittedAt: number
}

;(() => {
  if (window.__lceInjected) return
  window.__lceInjected = true
  console.log('[LCE/inject] loaded in MAIN world')

  let lastSubmit: LastSubmit | null = null
  let watchUntil = 0

  const SUBMIT_URL_RE = /\/problems\/[^/]+\/submit\/?($|\?)/
  const CHECK_URL_RE = /\/submissions\/detail\/\d+\/check\//
  const GRAPHQL_RE = /\/graphql\/?$/
  // Run-against-samples endpoints — never trigger the accepted flow on these.
  const INTERPRET_URL_RE = /\/interpret/

  // ---- fetch patch ----
  const origFetch = window.fetch
  window.fetch = async function patchedFetch(...args: any[]) {
    const reqUrl: string = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
    const reqMethod: string = (
      args[1]?.method ||
      (typeof args[0] !== 'string' ? args[0]?.method : 'GET') ||
      'GET'
    ).toUpperCase()
    const reqBody: string = args[1]?.body ? String(args[1].body) : ''

    const isSubmitPost = SUBMIT_URL_RE.test(reqUrl) && reqMethod === 'POST'

    if (isSubmitPost) {
      try {
        const parsed = JSON.parse(reqBody)
        const slugMatch = reqUrl.match(/\/problems\/([^/]+)\//)
        lastSubmit = {
          slug: slugMatch ? (slugMatch[1] ?? null) : null,
          lang: parsed.lang,
          questionId: parsed.question_id,
          code: parsed.typed_code,
          submittedAt: Date.now(),
        }
        watchUntil = Date.now() + 30000
        console.log('[LCE/inject] captured submit body', {
          slug: lastSubmit.slug,
          lang: lastSubmit.lang,
        })
      } catch (e) {
        console.warn('[LCE/inject] submit body parse failed', e)
      }
    }

    const res = await origFetch.apply(this, args as Parameters<typeof fetch>)

    if (Date.now() < watchUntil) {
      console.log('[LCE/inject] watch fetch', reqMethod, reqUrl)
      try {
        const clone = res.clone()
        clone
          .text()
          .then((t) => {
            if (t && t.length < 4000)
              console.log('[LCE/inject] watch response', reqUrl, t.slice(0, 600))
            else if (t)
              console.log('[LCE/inject] watch response (truncated)', reqUrl, t.slice(0, 600))
            maybeHandleAccepted(t, reqUrl)
          })
          .catch(() => {})
      } catch {}
    } else if (
      CHECK_URL_RE.test(reqUrl) ||
      (GRAPHQL_RE.test(reqUrl) && /submission/i.test(reqBody))
    ) {
      try {
        const clone = res.clone()
        clone
          .text()
          .then((t) => maybeHandleAccepted(t, reqUrl))
          .catch(() => {})
      } catch {}
    }

    if (isSubmitPost) {
      try {
        const clone = res.clone()
        clone
          .text()
          .then((t) => {
            console.log('[LCE/inject] submit response', reqUrl, t.slice(0, 600))
            maybeHandleAccepted(t, reqUrl)
          })
          .catch(() => {})
      } catch {}
    }

    return res
  }

  // ---- XHR patch (some LC paths still use XHR) ----
  const OrigXHR = window.XMLHttpRequest
  function PatchedXHR(this: unknown) {
    const xhr = new OrigXHR()
    let url = ''
    let method = ''
    const origOpen = xhr.open
    xhr.open = function (m: string, u: string | URL, ...rest: any[]) {
      method = m
      url = String(u)
      return (origOpen as any).call(this, m, u, ...rest)
    }
    const origSend = xhr.send
    xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      xhr.addEventListener('load', () => {
        if (Date.now() < watchUntil) {
          console.log('[LCE/inject] watch XHR', method, url, (xhr.responseText || '').slice(0, 600))
          maybeHandleAccepted(xhr.responseText, url)
        }
      })
      return origSend.call(this, body)
    }
    return xhr
  }
  PatchedXHR.prototype = OrigXHR.prototype
  window.XMLHttpRequest = PatchedXHR as unknown as typeof XMLHttpRequest

  // ---- WebSocket patch (LC v2 may push verdict over WS) ----
  const OrigWS = window.WebSocket
  function PatchedWS(this: unknown, url: string | URL, protocols?: string | string[]) {
    console.log('[LCE/inject] WebSocket opened', url)
    const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url)
    ws.addEventListener('message', (evt: MessageEvent) => {
      if (Date.now() < watchUntil) {
        const data = typeof evt.data === 'string' ? evt.data : '(binary)'
        console.log('[LCE/inject] WS message', url, data.slice(0, 600))
        if (typeof evt.data === 'string') maybeHandleAccepted(evt.data, String(url))
      }
    })
    return ws
  }
  PatchedWS.prototype = OrigWS.prototype
  Object.setPrototypeOf(PatchedWS, OrigWS)
  window.WebSocket = PatchedWS as unknown as typeof WebSocket

  function maybeHandleAccepted(text: string, url: string) {
    if (!text) return
    if (INTERPRET_URL_RE.test(url)) return
    try {
      const data = JSON.parse(text)
      const result = extractResult(data)
      if (result && result.statusMsg === 'Accepted') {
        const codeBundle =
          lastSubmit && Date.now() - lastSubmit.submittedAt < 60000
            ? { code: lastSubmit.code, lang: lastSubmit.lang, slug: lastSubmit.slug }
            : {}
        console.log('[LCE/inject] posting accepted event from', url)
        window.postMessage(
          { source: 'lce-detector', event: 'accepted', payload: { ...result, ...codeBundle } },
          '*',
        )
        watchUntil = 0
      }
    } catch {}
  }

  function extractResult(data: any): {
    statusMsg: string
    state?: string
    questionId?: string
    runtime?: string
    memory?: string
    lang?: string
  } | null {
    if (!data) return null
    if (data.status_msg) {
      return {
        statusMsg: data.status_msg,
        state: data.state,
        questionId: data.question_id,
        runtime: data.status_runtime,
        memory: data.status_memory,
        lang: data.lang,
      }
    }
    const candidates = [
      data?.data?.submissionDetails,
      data?.submissionDetails,
      data?.data?.submitSubmission,
      data?.data?.submissionResult,
      data?.data?.submission,
      data?.submission,
      data?.data?.checkSubmission,
      data?.checkSubmission,
    ]
    for (const sub of candidates) {
      if (!sub) continue
      const status = sub.statusDisplay || sub.statusMsg || sub.status_msg || sub.status
      if (status) {
        return {
          statusMsg: status,
          state: sub.state,
          questionId: sub.questionId,
          runtime: sub.runtimeDisplay,
          memory: sub.memoryDisplay,
          lang: sub.lang?.name || sub.lang,
        }
      }
    }
    return null
  }
})()

export {}
