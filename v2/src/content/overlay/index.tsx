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
import type { Difficulty, DueProblem, SolvePayload } from '../../engine/types'
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
  }
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(8, 4, 10, 0.65);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    pointer-events: auto;
  }
  .modal {
    background: #1D181D; color: #F0EDEA;
    border: 1px solid #3B323A; border-radius: 12px;
    width: min(440px, 92vw); padding: 24px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  }
  .kicker { font-size: 11.5px; font-weight: 500; color: #8A8386; margin-bottom: 6px; }
  .kicker .accepted { color: #57C690; font-weight: 600; }
  .name { font-size: 17px; font-weight: 600; letter-spacing: -0.015em; margin-bottom: 18px; overflow-wrap: anywhere; }
  .label { font-size: 11.5px; font-weight: 500; color: #8A8386; margin-bottom: 6px; }
  .segs { display: flex; gap: 6px; margin-bottom: 16px; border: 0; padding: 0; margin-top: 0; }
  .seg {
    flex: 1; padding: 8px 0; border: 1px solid #2B242B; border-radius: 6px;
    background: #1D181D; color: #ADA6A6; cursor: pointer;
    font-size: 13px; font-weight: 500; font-family: inherit;
    transition: background 100ms ease, color 100ms ease, border-color 100ms ease;
  }
  .seg:hover { background: #251F25; color: #F0EDEA; }
  .seg.active { border-color: #FF6F3C; background: rgba(255, 111, 60, 0.12); color: #FF6F3C; }
  textarea {
    width: 100%; min-height: 72px; resize: vertical; padding: 9px 12px;
    border: 1px solid #2B242B; border-radius: 6px;
    background: #161216; color: #F0EDEA;
    font-family: inherit; font-size: 13px; letter-spacing: inherit;
    margin-bottom: 14px;
  }
  textarea::placeholder { color: #8A8386; }
  textarea:focus { outline: none; border-color: #3B323A; background: #251F25; }
  .toggles { display: flex; gap: 16px; margin-bottom: 18px; }
  .toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #ADA6A6; cursor: pointer; }
  .toggle input { width: 14px; height: 14px; accent-color: #FF6F3C; margin: 0; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .btn {
    border-radius: 6px; padding: 8px 16px; cursor: pointer;
    font-size: 12.5px; font-weight: 500; font-family: inherit; letter-spacing: inherit;
    transition: background 100ms ease, color 100ms ease, border-color 100ms ease;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn.ghost { background: transparent; color: #ADA6A6; border: 1px solid transparent; }
  .btn.ghost:hover:not(:disabled) { background: #251F25; color: #F0EDEA; border-color: #2B242B; }
  .btn.save { background: #FF6F3C; color: #161216; border: 1px solid #FF6F3C; font-weight: 600; }
  .btn.save:hover:not(:disabled) { background: #FF8456; border-color: #FF8456; }
  .err { color: #EF6F6C; font-size: 11.5px; margin-top: 10px; min-height: 16px; }
  .spinner {
    width: 11px; height: 11px; display: inline-block; vertical-align: -1px;
    border: 2px solid currentColor; border-right-color: transparent;
    border-radius: 50%; animation: lce-spin 0.7s linear infinite;
  }
  @keyframes lce-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 1.6s; } }

  .bar {
    background: #161216; color: #F0EDEA;
    border-bottom: 1px solid #3B323A;
    padding: 8px 16px; font-size: 12.5px;
    display: flex; align-items: center; gap: 10px;
  }
  .bar svg { color: #8A8386; flex-shrink: 0; }
  .bar a { color: #97A3FF; text-decoration: none; font-weight: 500; }
  .bar a:hover { text-decoration: underline; }
  .bar .close {
    margin-left: auto; cursor: pointer; color: #8A8386;
    background: none; border: 0; font-size: 13px; font-family: inherit;
    padding: 0 4px; line-height: 1;
  }
  .bar .close:hover { color: #F0EDEA; }
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
    const res = await send({ type: 'recordSolve', payload })
    setSaving(false)
    if (isMsgError(res)) {
      setErr(`Save failed — ${res.error}`)
      return
    }
    onDone(true)
  }

  return (
    <div className="root">
      <div className="backdrop">
        <div role="dialog" aria-modal="true" aria-label="Rate this solve" className="modal">
          <div className="kicker">
            <span className="accepted">Accepted</span> — rate it
          </div>
          <div className="name">{meta.title}</div>

          <div className="label">Confidence</div>
          <fieldset className="segs" aria-label="Confidence">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={confidence === n}
                className={`seg${confidence === n ? ' active' : ''}`}
                onClick={() => setConfidence(n)}
              >
                {n}
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
                  <span className="spinner" /> Saving…
                </>
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

// ---------- due banner ----------

function DueBanner({ due, onClose }: { due: DueProblem[]; onClose: () => void }) {
  const first = due[0]
  if (!first) return null
  return (
    <div className="root">
      <div className="bar">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M8 5v3l2 1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <span>
          {due.length} review{due.length === 1 ? '' : 's'} due —{' '}
          <a href={first.url}>start with “{first.title}”</a>
        </span>
        <button type="button" className="close" title="Hide" aria-label="Hide" onClick={onClose}>
          ×
        </button>
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
let bannerMount: { host: HTMLElement; root: Root } | null = null
let processedAt = 0

function destroyOverlay() {
  if (overlayMount) {
    overlayMount.root.unmount()
    overlayMount.host.remove()
    overlayMount = null
  }
}

function destroyBanner() {
  if (bannerMount) {
    bannerMount.root.unmount()
    bannerMount.host.remove()
    bannerMount = null
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
        onDone={(saved) => {
          destroyOverlay()
          if (saved) setTimeout(setupBanner, 500)
        }}
      />
    </StrictMode>,
  )
}

async function setupBanner() {
  destroyBanner()
  const due = await send({ type: 'getDueProblems', limit: 5 })
  if (isMsgError(due) || !Array.isArray(due) || due.length === 0) return
  bannerMount = makeShadowRoot(
    'lce-banner-host',
    'position:fixed;top:0;left:0;right:0;z-index:2147483646;',
  )
  bannerMount.root.render(
    <StrictMode>
      <DueBanner due={due} onClose={destroyBanner} />
    </StrictMode>,
  )
}

function init() {
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

  setupBanner()

  let lastPath = location.pathname
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname
      setupBanner()
    }
  }, 1000)
}

init()
