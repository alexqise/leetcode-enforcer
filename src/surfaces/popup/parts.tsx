// Shared popup building blocks — data-independent widgets in the
// settings-rework form language (underline fields, soft fills, no boxes).
// The layout variants in PopupMain.variant-*.tsx compose these.

import { useCallback, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Checkbox } from '../../components/Checkbox'
import { DueRow } from '../../components/DueRow'
import {
  AlertCircleIcon,
  FlameIcon,
  GearIcon,
  GithubIcon,
  ListIcon,
  LockIcon,
  SearchIcon,
  UserIcon,
} from '../../components/icons'
import { Spinner } from '../../components/Spinner'
import type { CatalogItem } from '../../engine/types'
import { isMsgError, type StatusResponse, send } from '../../messages'

export const VIEWER_PATH = 'src/surfaces/viewer/index.html'
export const OPTIONS_PATH = 'src/surfaces/options/index.html'

export interface PopupMainProps {
  status: StatusResponse | null
  refresh: () => void
  onSignOutClick: () => void
}

export function openTab(path: string) {
  chrome.tabs.create({ url: chrome.runtime.getURL(path) })
}

// ---------- header atoms ----------

export function IconButton({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-fg-3 transition-colors duration-100 hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  )
}

export function HeaderActions() {
  return (
    <div className="flex items-center gap-0.5">
      <IconButton title="View all problems" onClick={() => openTab(VIEWER_PATH)}>
        <ListIcon />
      </IconButton>
      <IconButton title="Settings" onClick={() => openTab(OPTIONS_PATH)}>
        <GearIcon />
      </IconButton>
    </div>
  )
}

export function StreakInline({ status }: { status: StatusResponse | null }) {
  return (
    <span
      title="Streak"
      className="flex items-center gap-1.5 text-[11.5px] tracking-[-0.003em] text-fg-2"
    >
      <FlameIcon className="text-medium" />
      <span>
        <span className="font-medium text-fg">{status?.state.streakDays ?? 0}</span>
        -day streak
      </span>
    </span>
  )
}

export function blockStateText(status: StatusResponse | null): string {
  if (!status) return ''
  if (status.blockActive) return 'Blocking is active.'
  if (status.state.overrideActiveUntil) {
    const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
    return `Override active until ${timeFmt.format(new Date(status.state.overrideActiveUntil))}.`
  }
  return 'Quota met — sites unblocked.'
}

// ---------- sync error ----------

export function SyncError({
  status,
  onRetried,
}: {
  status: StatusResponse
  onRetried: () => void
}) {
  const [busy, setBusy] = useState(false)
  const parts: string[] = []
  if (status.state.lastSyncError) parts.push(`Sync: ${status.state.lastSyncError}`)
  if (status.state.lastGithubError) parts.push(`GitHub: ${status.state.lastGithubError}`)
  if (parts.length === 0) return null
  const msg = parts.join(' · ')

  return (
    <div className="mx-4 mt-2 flex items-center gap-2 rounded-md bg-[rgba(239,111,108,0.08)] px-2.5 py-2 text-[11.5px] text-fg-2">
      <AlertCircleIcon className="shrink-0 text-hard" />
      <span title={msg} className="min-w-0 flex-1 truncate">
        {msg}
      </span>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true)
          await send({ type: 'retryLastSync' })
          setBusy(false)
          onRetried()
        }}
        className="shrink-0 cursor-pointer rounded border-0 bg-transparent px-1.5 py-0.5 font-medium text-fg transition-colors duration-100 hover:bg-surface-2 disabled:opacity-50"
      >
        {busy ? <Spinner /> : 'Retry'}
      </button>
    </div>
  )
}

// ---------- due list ----------

export function DueList({
  status,
  cap,
  emptyText = 'No reviews due today.',
}: {
  status: StatusResponse | null
  cap: number
  emptyText?: string
}) {
  const due = status?.due ?? []
  if (due.length === 0) {
    return <div className="py-2 text-[12.5px] tracking-[-0.003em] text-fg-3">{emptyText}</div>
  }
  return (
    <div className="flex flex-col">
      {due.slice(0, cap).map((p) => (
        <DueRow key={p.slug} problem={p} target="_blank" />
      ))}
      {due.length > cap && (
        <button
          type="button"
          onClick={() => openTab(VIEWER_PATH)}
          className="mt-1 cursor-pointer self-start rounded border-0 bg-transparent p-0 text-[11.5px] font-medium text-secondary transition-colors duration-100 hover:text-fg"
        >
          View all {due.length} in Problems
        </button>
      )}
    </div>
  )
}

// ---------- log a problem ----------

export function LogProblem({ onSaved }: { onSaved: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogItem[] | null>(null)
  const [picked, setPicked] = useState<CatalogItem | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [needReview, setNeedReview] = useState(false)
  const [mastered, setMastered] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const seqRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = useCallback((q: string) => {
    clearTimeout(timerRef.current)
    if (!q.trim()) {
      seqRef.current++
      setResults(null)
      return
    }
    const seq = ++seqRef.current
    timerRef.current = setTimeout(async () => {
      const res = await send({ type: 'searchCatalog', query: q.trim(), limit: 8 })
      if (seq !== seqRef.current) return
      setResults(isMsgError(res) ? [] : res)
    }, 180)
  }, [])

  function reset() {
    setPicked(null)
    setConfidence(null)
    setNotes('')
    setNeedReview(false)
    setMastered(false)
    setErr('')
  }

  async function save() {
    if (!picked || saving) return
    setErr('')
    setSaving(true)
    const res = await send({
      type: 'manualEntry',
      payload: {
        ...picked,
        confidence,
        notes: notes.trim(),
        needReview,
        mastered,
      },
    })
    setSaving(false)
    if (isMsgError(res)) {
      setErr(`Save failed: ${res.error}`)
      return
    }
    reset()
    onSaved()
  }

  return (
    <div>
      {!picked && (
        <>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-1 -translate-y-1/2 text-fg-3" />
            <input
              type="text"
              value={query}
              placeholder="Search by # or title"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setQuery(e.target.value)
                search(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('')
                  setResults(null)
                  e.currentTarget.blur()
                }
              }}
              className="w-full rounded-none border-0 border-b border-border bg-surface/50 py-2 pr-2 pl-7 text-[12.5px] text-fg transition-colors duration-100 placeholder:text-fg-3 focus:border-fg-3 focus:outline-none"
            />
          </div>
          {results && (
            <div className="mt-1.5 flex flex-col">
              {results.length === 0 ? (
                <div className="py-1.5 text-xs text-fg-3">No matches for “{query.trim()}”.</div>
              ) : (
                results.map((p) => (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => {
                      setPicked(p)
                      setQuery('')
                      setResults(null)
                    }}
                    className="-mx-2 cursor-pointer rounded-md border-0 bg-transparent px-2 py-1.5 text-left transition-colors duration-100 hover:bg-surface"
                  >
                    <div className="truncate text-[12.5px] text-fg">
                      <strong className="font-semibold">{p.number}.</strong> {p.title}
                    </div>
                    <div className="text-[11px] text-fg-3">
                      {p.difficulty}
                      {p.topics.length > 0 && ` · ${p.topics.slice(0, 3).join(', ')}`}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      {picked && (
        <div>
          <div className="mb-2.5 text-[12.5px] font-medium text-fg">
            {picked.number}. {picked.title}{' '}
            <span className="font-normal text-fg-3">— {picked.difficulty}</span>
          </div>

          <div className="mb-2.5">
            <div className="mb-1.5 text-[11.5px] font-medium tracking-[-0.003em] text-fg-3">
              Confidence
            </div>
            <fieldset className="m-0 flex gap-1.5 border-0 p-0" aria-label="Confidence">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={confidence === n}
                  onClick={() => setConfidence(n)}
                  className={`flex-1 cursor-pointer rounded-md border-0 py-1.5 text-[12.5px] font-medium transition-colors duration-100 ${
                    confidence === n
                      ? 'bg-primary-dim text-primary'
                      : 'bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg'
                  }`}
                >
                  {n}
                </button>
              ))}
            </fieldset>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            spellCheck={false}
            className="mb-2.5 min-h-[52px] w-full resize-y rounded-none border-0 border-b border-border bg-surface/50 px-2 py-2 text-[12.5px] text-fg transition-colors duration-100 placeholder:text-fg-3 focus:border-fg-3 focus:outline-none"
          />

          <div className="mb-3 flex gap-4">
            <div className="flex items-center gap-1.5 text-xs text-fg-2">
              <Checkbox checked={needReview} onChange={setNeedReview} aria-label="Need review" />
              <span>Need review</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-fg-2">
              <Checkbox checked={mastered} onChange={setMastered} aria-label="Mastered" />
              <span>Mastered</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button variant="primary" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          {err && (
            <div role="alert" className="mt-2 text-[11.5px] text-hard">
              {err}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- footer ----------

export function FootAuth({
  status,
  onSignOutClick,
}: {
  status: StatusResponse | null
  onSignOutClick: () => void
}) {
  const [busy, setBusy] = useState(false)
  const signedIn = status?.signedIn ?? false

  if (signedIn) {
    return (
      <button
        type="button"
        onClick={onSignOutClick}
        className="flex max-w-[55%] cursor-pointer items-center gap-1.5 truncate rounded border-0 bg-transparent p-0 text-[11.5px] text-fg-3 transition-colors duration-100 hover:text-fg"
      >
        <UserIcon className="shrink-0" />
        <span className="truncate">{status?.user?.name || status?.user?.email || 'Signed in'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await send({ type: 'signInGoogle' })
        setBusy(false)
      }}
      className="flex cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent p-0 text-[11.5px] text-fg-3 transition-colors duration-100 hover:text-fg disabled:opacity-50"
    >
      <LockIcon className="shrink-0" />
      {busy ? 'Signing in…' : 'Sign in with Google'}
    </button>
  )
}

export function FootGithub({ status }: { status: StatusResponse | null }) {
  const connected = !!(status?.settings.githubEnabled && status.settings.githubRepoUrl)
  return (
    <a
      href={connected ? (status?.settings.githubRepoUrl ?? '#') : '#'}
      target={connected ? '_blank' : undefined}
      rel={connected ? 'noreferrer' : undefined}
      onClick={(e) => {
        if (!connected) {
          e.preventDefault()
          chrome.tabs.create({ url: `${chrome.runtime.getURL(OPTIONS_PATH)}#github` })
        }
      }}
      className="flex items-center gap-1.5 text-[11.5px] text-fg-3 no-underline transition-colors duration-100 hover:text-fg"
    >
      <GithubIcon className="shrink-0" />
      {connected ? 'Open repo' : 'Connect GitHub'}
    </a>
  )
}
