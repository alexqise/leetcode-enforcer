// ISOLATED-world content script: the rating overlay + due banner on
// leetcode.com, rebuilt as React roots in closed Shadow DOM (SPEC §4).
// Listens for 'accepted' events posted by the MAIN-world inject script.
//
// Styling is handwritten dusk-signal CSS injected into each shadow root —
// Tailwind utilities can't cross the shadow boundary, and page-injected
// CSS can't resolve extension font assets, so the overlay uses the
// system font stack (matching v1's behavior on the LC page).

import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Difficulty, SolvePayload } from '../../engine/types'
import { isMsgError, send } from '../../messages'

interface AcceptedPayload {
  code?: string | null
  lang?: string | null
  [key: string]: unknown
}

interface PageMeta {
  slug: string
  number: number | null
  title: string
  url: string
  difficulty: Difficulty
  topics: string[]
}

// ---------- page meta scraping (ported verbatim from v1) ----------

function currentSlug(): string | null {
  const m = location.pathname.match(/^\/problems\/([^/]+)/)
  return m?.[1] ?? null
}

function guessNumber(): number | null {
  const text = document.body.innerText || ''
  const m = text.match(/(\d+)\.\s+[A-Z]/)
  return m?.[1] ? Number.parseInt(m[1], 10) : null
}

function guessTitle(slug: string): string {
  const ogTitle = document
    .querySelector<HTMLMetaElement>('meta[property="og:title"]')
    ?.content?.replace(/\s*-\s*LeetCode$/, '')
    .trim()
  if (ogTitle) return ogTitle
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function guessDifficulty(): Difficulty {
  const txt = (document.body.innerText || '').slice(0, 4000)
  if (/\bHard\b/.test(txt)) return 'Hard'
  if (/\bMedium\b/.test(txt)) return 'Medium'
  if (/\bEasy\b/.test(txt)) return 'Easy'
  return 'Unknown'
}

function readPageMeta(): PageMeta | null {
  const slug = currentSlug()
  if (!slug) return null
  return {
    slug,
    number: guessNumber(),
    title: guessTitle(slug),
    url: `https://leetcode.com/problems/${slug}/`,
    difficulty: guessDifficulty(),
    topics: [],
  }
}

// ---------- shadow CSS (dusk-signal values, system font stack) ----------

const SHADOW_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    letter-spacing: -0.005em;
    -webkit-font-smoothing: antialiased;
    color: #F0EDEA;
  }
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(6, 3, 8, 0.72);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    pointer-events: auto;
  }
  .modal {
    background: #1A151A;
    border: 1px solid #2B242B;
    border-radius: 10px;
    width: min(400px, 92vw);
    padding: 20px 22px 18px;
    box-shadow: 0 20px 56px rgba(0, 0, 0, 0.62);
  }

  .kicker { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
  .accepted {
    font-size: 10.5px; font-weight: 600; letter-spacing: 0.01em;
    color: #57C690;
    background: rgba(87, 198, 144, 0.1);
    border: 1px solid rgba(87, 198, 144, 0.18);
    border-radius: 4px;
    padding: 2px 6px;
  }
  .kicker-rest { font-size: 11.5px; color: #3D373D; }
  .name {
    font-size: 15px; font-weight: 600; letter-spacing: -0.015em;
    line-height: 1.3; margin-bottom: 18px; overflow-wrap: anywhere;
  }

  .label {
    font-size: 10.5px; font-weight: 500; letter-spacing: 0.05em;
    text-transform: uppercase; color: #4A4248; margin-bottom: 7px;
  }

  .segs {
    display: flex; gap: 2px; border: 0; margin: 0 0 16px;
    background: #111011; border-radius: 7px; padding: 3px;
  }
  .seg {
    flex: 1; padding: 5px 0; border: none; border-radius: 5px;
    background: transparent; color: #3D373D; cursor: pointer;
    font-size: 11px; font-weight: 500; font-family: inherit; line-height: 1;
    transition: background 80ms, color 80ms;
  }
  .seg:hover:not(.active) { background: #221C22; color: #8A8386; }
  .seg.active { background: #FF6F3C; color: #1A0008; font-weight: 600; }

  textarea {
    width: 100%; min-height: 64px; resize: vertical; padding: 9px 11px;
    border: 1px solid #231D23; border-radius: 6px;
    background: #111011; color: #F0EDEA;
    font-family: inherit; font-size: 13px; letter-spacing: inherit;
    margin-bottom: 14px; display: block;
  }
  textarea::placeholder { color: #3A343A; }
  textarea:focus { outline: none; border-color: #3B323A; }

  .toggles { display: flex; gap: 18px; margin-bottom: 18px; }
  .toggle {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; color: #6B6368; cursor: pointer;
  }
  .toggle input { width: 13px; height: 13px; accent-color: #FF6F3C; margin: 0; cursor: pointer; }

  .sep { border: none; border-top: 1px solid #1F1A1F; margin: 0 0 16px; }

  .actions { display: flex; justify-content: flex-end; align-items: center; gap: 2px; }
  .btn {
    border: none; border-radius: 6px; padding: 7px 15px; cursor: pointer;
    font-size: 12.5px; font-weight: 500; font-family: inherit; letter-spacing: inherit;
    transition: background 100ms, color 100ms, opacity 100ms;
  }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn.ghost { background: transparent; color: #4A4248; }
  .btn.ghost:hover:not(:disabled) { color: #ADA6A6; }
  .btn.save { background: #FF6F3C; color: #110800; font-weight: 600; }
  .btn.save:hover:not(:disabled) { background: #FF8456; }

  .err { color: #EF6F6C; font-size: 11.5px; margin-top: 10px; min-height: 16px; }
  .spinner {
    width: 11px; height: 11px; display: inline-block; vertical-align: -1px;
    border: 2px solid currentColor; border-right-color: transparent;
    border-radius: 50%; animation: lce-spin 0.7s linear infinite;
  }
  @keyframes lce-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 1.6s; } }
`

// ---------- rating overlay ----------

function RatingOverlay({
  meta,
  accepted,
  onDone,
}: {
  meta: PageMeta
  accepted: AcceptedPayload
  onDone: (saved: boolean) => void
}) {
  const [confidence, setConfidence] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [needReview, setNeedReview] = useState(false)
  const [mastered, setMastered] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [attempts, setAttempts] = useState(0)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  async function save() {
    if (saving) return
    setSaving(true)
    setErr('')
    let payload: SolvePayload = {
      ...meta,
      confidence,
      notes: notes.trim(),
      needReview,
      mastered,
      code: accepted.code ?? null,
      lang: accepted.lang ?? null,
    }
    // Enrich difficulty/topics from the LC API when scraping came up short.
    if (payload.difficulty === 'Unknown' || payload.topics.length === 0) {
      const enriched = await send({ type: 'getProblemMeta', slug: meta.slug })
      if (enriched && !isMsgError(enriched) && !('error' in enriched)) {
        payload = { ...payload, ...enriched }
      }
    }
    const attempt = attempts + 1
    setAttempts(attempt)
    const res = await send({ type: 'recordSolve', payload })
    if (!isMsgError(res)) {
      onDone(true)
      return
    }
    // First failure: auto-retry once after a short delay (handles service worker restarts).
    if (attempt === 1) {
      await new Promise((r) => setTimeout(r, 1500))
      const retry = await send({ type: 'recordSolve', payload })
      if (!isMsgError(retry)) {
        onDone(true)
        return
      }
    }
    setSaving(false)
    setErr('Could not save — your solve is tracked locally. Try again or close to skip.')
  }

  return (
    <div className="root">
      <div className="backdrop">
        <div role="dialog" aria-modal="true" aria-label="Rate this solve" className="modal">
          <div className="kicker">
            <span className="accepted">Accepted</span>
            <span className="kicker-rest">— rate it</span>
          </div>
          <div className="name">{meta.title}</div>

          <div className="label">Confidence</div>
          <fieldset className="segs" aria-label="Confidence">
            {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={confidence === n}
                className={`seg${confidence === n ? ' active' : ''}`}
                onClick={() => setConfidence(n)}
              >
                {n % 1 === 0 ? n : n.toFixed(1)}
              </button>
            ))}
          </fieldset>

          <div className="label">Notes</div>
          <textarea
            ref={textRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key insight, gotcha, pattern…"
            spellCheck={false}
          />

          <div className="toggles">
            <label className="toggle">
              <input
                type="checkbox"
                checked={needReview}
                onChange={(e) => setNeedReview(e.target.checked)}
              />
              Need to review again
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={mastered}
                onChange={(e) => setMastered(e.target.checked)}
              />
              Mastered — don't review
            </label>
          </div>

          <hr className="sep" />
          <div className="actions">
            <button
              type="button"
              className="btn ghost"
              disabled={saving}
              onClick={() => onDone(false)}
            >
              Skip for now
            </button>
            <button type="button" className="btn save" disabled={saving} onClick={save}>
              {saving ? (
                <>
                  <span className="spinner" /> {attempts === 1 ? 'Retrying…' : 'Saving…'}
                </>
              ) : err ? (
                'Try again'
              ) : (
                'Save'
              )}
            </button>
          </div>
          <div className="err" role="alert">
            {err}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- mounting (closed shadow roots) ----------

function makeShadowRoot(id: string, hostCss: string): { host: HTMLElement; root: Root } {
  const host = document.createElement('div')
  host.id = id
  host.style.cssText = hostCss
  document.documentElement.appendChild(host)
  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = SHADOW_CSS
  shadow.appendChild(style)
  const container = document.createElement('div')
  shadow.appendChild(container)
  return { host, root: createRoot(container) }
}

let overlayMount: { host: HTMLElement; root: Root } | null = null
let processedAt = 0

function destroyOverlay() {
  if (overlayMount) {
    overlayMount.root.unmount()
    overlayMount.host.remove()
    overlayMount = null
  }
}

function showRatingOverlay(accepted: AcceptedPayload) {
  const meta = readPageMeta()
  if (!meta) return
  destroyOverlay()
  overlayMount = makeShadowRoot(
    'lce-overlay-host',
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;',
  )
  overlayMount.root.render(
    <StrictMode>
      <RatingOverlay
        meta={meta}
        accepted={accepted}
        onDone={() => {
          destroyOverlay()
        }}
      />
    </StrictMode>,
  )
}

declare global {
  interface Window {
    __lceOverlayLoaded?: boolean
  }
}

function init() {
  // Guard against double-injection (declarative + onInstalled reinject).
  if (window.__lceOverlayLoaded) return
  window.__lceOverlayLoaded = true
  console.log('[LCE/overlay] loaded in ISOLATED world on', location.href)

  window.addEventListener('message', (evt: MessageEvent) => {
    if (evt.source !== window) return
    const m = evt.data
    if (m?.source !== 'lce-detector') return
    if (m.event === 'accepted') {
      const now = Date.now()
      if (now - processedAt < 2000) return
      processedAt = now
      showRatingOverlay(m.payload || {})
    }
  })

}

init()
