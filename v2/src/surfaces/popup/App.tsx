// Popup — same content model as v1 (auth gate, progress, review queue
// capped at 8, log-a-problem, footer links), dusk-signal skin with
// shared components (SPEC §4).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { DueRow } from '../../components/DueRow'
import {
  AlertCircleIcon,
  BrandIcon,
  CheckSquareIcon,
  ClockIcon,
  CubeIcon,
  FlameIcon,
  GearIcon,
  GithubIcon,
  GoogleIcon,
  ListIcon,
  LockIcon,
  SearchIcon,
  UserIcon,
} from '../../components/icons'
import { SectionLabel } from '../../components/SectionLabel'
import { SegmentedBar } from '../../components/SegmentedBar'
import { Spinner } from '../../components/Spinner'
import type { CatalogItem } from '../../engine/types'
import { useStatus } from '../../hooks/useStatus'
import { isMsgError, type StatusResponse, send } from '../../messages'

const VIEWER_PATH = 'src/surfaces/viewer/index.html'
const OPTIONS_PATH = 'src/surfaces/options/index.html'

type DialogState =
  | null
  | { kind: 'signOutConfirm' }
  | { kind: 'importConfirm'; username: string }
  | { kind: 'notice'; title: string; body: string }

export function App() {
  const [gate, setGate] = useState<'checking' | 'signedOut' | 'in'>('checking')

  useEffect(() => {
    send({ type: 'getAuthState' }).then((res) => {
      setGate(!isMsgError(res) && res.signedIn ? 'in' : 'signedOut')
    })
  }, [])

  if (gate === 'checking') return <div className="h-40 w-[340px]" />
  if (gate === 'signedOut') return <AuthGate onSignedIn={() => setGate('in')} />
  return <Main />
}

// ---------- Auth gate ----------

function AuthGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function signIn() {
    if (busy) return
    setBusy(true)
    setErr('')
    const res = await send({ type: 'signInGoogle' })
    if (!isMsgError(res) && res.ok) {
      onSignedIn()
    } else {
      setBusy(false)
      setErr(`Sign-in failed: ${isMsgError(res) ? res.error : res.error || 'unknown'}`)
    }
  }

  return (
    <div className="w-[340px] px-6 py-8">
      <div
        aria-hidden="true"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-border-2 bg-surface text-fg-2"
      >
        <BrandIcon size={22} />
      </div>
      <h1 className="m-0 mb-1.5 text-[17px] font-semibold tracking-[-0.02em] text-fg">
        Sign in to track your practice
      </h1>
      <p className="m-0 mb-5 text-[12.5px] leading-[1.5] tracking-[-0.003em] text-fg-3">
        Your tracked work is privately synced to your Google account.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={signIn}
        className="mb-6 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-md border border-border-2 bg-surface-2 px-4 py-2.5 text-[13px] font-semibold tracking-[-0.003em] text-fg transition-colors duration-100 hover:enabled:border-fg-3 hover:enabled:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Spinner /> : <GoogleIcon />}
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>
      <div className="flex flex-col gap-2.5">
        <AuthFeature icon={<CheckSquareIcon className="mt-0.5 shrink-0 text-fg-3" />}>
          Hard-block YouTube, IG, TikTok until your quota is met
        </AuthFeature>
        <AuthFeature icon={<ClockIcon className="mt-0.5 shrink-0 text-fg-3" />}>
          Spaced repetition surfaces what to review
        </AuthFeature>
        <AuthFeature icon={<CubeIcon className="mt-0.5 shrink-0 text-fg-3" />}>
          Sync your progress across devices
        </AuthFeature>
      </div>
      {err && <div className="mt-4 text-[11.5px] text-hard">{err}</div>}
    </div>
  )
}

function AuthFeature({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-xs leading-[1.45] tracking-[-0.003em] text-fg-2">
      {icon}
      {children}
    </div>
  )
}

// ---------- Main popup ----------

function Main() {
  const { status, error, refresh } = useStatus()
  const [dlg, setDlg] = useState<DialogState>(null)
  const [dlgBusy, setDlgBusy] = useState(false)
  const promptedRef = useRef(false)

  // One-time history import prompt after first sign-in (parity with v1).
  useEffect(() => {
    if (promptedRef.current) return
    promptedRef.current = true
    ;(async () => {
      const { state = {} } = await chrome.storage.local.get('state')
      if (state.historyImportPrompted) return
      const login = await send({ type: 'getLeetcodeLoginStatus' })
      if (isMsgError(login) || !login.isSignedIn || !login.username) return
      await chrome.storage.local.set({ state: { ...state, historyImportPrompted: true } })
      setDlg({ kind: 'importConfirm', username: login.username })
    })()
  }, [])

  async function runImport() {
    setDlgBusy(true)
    const res = await send({ type: 'importLeetcodeHistory' })
    setDlgBusy(false)
    if (isMsgError(res) || !res.ok) {
      setDlg({
        kind: 'notice',
        title: 'Import failed',
        body: (isMsgError(res) ? res.error : res.error) || 'Unknown error.',
      })
    } else {
      setDlg({
        kind: 'notice',
        title: 'Import complete',
        body: `Imported ${res.imported} problems.`,
      })
    }
    refresh()
  }

  async function runSignOut() {
    setDlgBusy(true)
    await send({ type: 'signOut' })
    setDlgBusy(false)
    setDlg(null)
    refresh()
  }

  if (error) {
    return (
      <div className="w-[340px] p-5 text-[12.5px] leading-relaxed text-fg-2">
        Enforcer background unavailable — try reloading the extension.
      </div>
    )
  }

  return (
    <div className="flex w-[340px] flex-col">
      <header className="flex items-center justify-between px-4 pt-3.5 pb-1">
        <div className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.015em] text-fg">
          <BrandIcon size={15} className="text-fg-2" />
          Enforcer
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton
            title="View all problems"
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL(VIEWER_PATH) })}
          >
            <ListIcon />
          </IconButton>
          <IconButton
            title="Settings"
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL(OPTIONS_PATH) })}
          >
            <GearIcon />
          </IconButton>
        </div>
      </header>

      {status && <SyncError status={status} onRetried={refresh} />}

      <Progress status={status} />
      <ReviewQueue status={status} />
      <LogProblem onSaved={refresh} />

      <footer className="mt-1 flex items-center justify-between border-t border-border px-4 py-2.5">
        <FootAuth status={status} onSignOutClick={() => setDlg({ kind: 'signOutConfirm' })} />
        <FootGithub status={status} />
      </footer>

      <Dialog
        open={dlg?.kind === 'signOutConfirm'}
        onClose={() => setDlg(null)}
        title="Sign out?"
        mark={<LockIcon size={14} />}
        markTone="neutral"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDlg(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={dlgBusy} onClick={runSignOut}>
              Sign out
            </Button>
          </>
        }
      >
        <p className="m-0 mb-3.5 text-[12.5px] leading-[1.55] tracking-[-0.003em] text-fg-2">
          Your local data stays on this device.
        </p>
      </Dialog>

      <Dialog
        open={dlg?.kind === 'importConfirm'}
        onClose={() => setDlg(null)}
        title="Import LeetCode history?"
        mark={<ClockIcon size={14} />}
        markTone="neutral"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDlg(null)}>
              Not now
            </Button>
            <Button variant="primary" disabled={dlgBusy} onClick={runImport}>
              {dlgBusy ? 'Importing…' : 'Import'}
            </Button>
          </>
        }
      >
        <p className="m-0 mb-3.5 text-[12.5px] leading-[1.55] tracking-[-0.003em] text-fg-2">
          {dlg?.kind === 'importConfirm' && `Signed in as @${dlg.username}. `}
          One-time pull of your accepted submissions; entries are added as Mastered with no review
          impact. You can also do this later from Settings.
        </p>
      </Dialog>

      <Dialog
        open={dlg?.kind === 'notice'}
        onClose={() => setDlg(null)}
        title={dlg?.kind === 'notice' ? dlg.title : ''}
        actions={
          <Button variant="outline" onClick={() => setDlg(null)}>
            OK
          </Button>
        }
      >
        <p className="m-0 mb-3.5 text-[12.5px] leading-[1.55] tracking-[-0.003em] text-fg-2">
          {dlg?.kind === 'notice' ? dlg.body : ''}
        </p>
      </Dialog>
    </div>
  )
}

function IconButton({
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

// ---------- Sync error banner ----------

function SyncError({ status, onRetried }: { status: StatusResponse; onRetried: () => void }) {
  const [busy, setBusy] = useState(false)
  const parts: string[] = []
  if (status.state.lastSyncError) parts.push(`Sync: ${status.state.lastSyncError}`)
  if (status.state.lastGithubError) parts.push(`GitHub: ${status.state.lastGithubError}`)
  if (parts.length === 0) return null
  const msg = parts.join(' · ')

  return (
    <div className="mx-4 mt-2 flex items-center gap-2 rounded-md border border-[rgba(239,111,108,0.25)] bg-[rgba(239,111,108,0.08)] px-2.5 py-2 text-[11.5px] text-fg-2">
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

// ---------- Progress ----------

function Progress({ status }: { status: StatusResponse | null }) {
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
  const solved = status?.state.solvesToday ?? 0
  const quota = status?.settings.dailyQuota ?? 1

  const sub = !status
    ? ''
    : status.blockActive
      ? 'Blocking is active.'
      : status.state.overrideActiveUntil
        ? `Override active until ${timeFmt.format(new Date(status.state.overrideActiveUntil))}.`
        : 'Quota met — sites unblocked.'

  return (
    <section className="px-4 pt-3 pb-1" aria-label="Today's progress">
      <div className="mb-2.5 flex items-baseline justify-between">
        <div className="font-mono text-[22px] font-medium tracking-[-0.01em] text-fg">
          {solved} <span className="text-fg-3">/ {quota}</span>
        </div>
        <div
          title="Streak"
          className="flex items-center gap-1.5 text-[11.5px] tracking-[-0.003em] text-fg-2"
        >
          <FlameIcon className="text-medium" />
          <span>
            <span className="font-mono font-medium text-fg">{status?.state.streakDays ?? 0}</span>
            -day streak
          </span>
        </div>
      </div>
      <SegmentedBar
        total={Math.max(1, quota)}
        filled={solved}
        label="Daily quota"
        className="mb-2"
      />
      <div className="text-[11.5px] tracking-[-0.003em] text-fg-3">{sub}</div>
    </section>
  )
}

// ---------- Review queue ----------

function ReviewQueue({ status }: { status: StatusResponse | null }) {
  const due = status?.due ?? []
  return (
    <section className="px-4 pt-4" aria-label="Review queue">
      <div className="mb-1 flex items-center justify-between">
        <SectionLabel icon={<ClockIcon />} className="mb-0">
          Review queue
        </SectionLabel>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-fg-2">
          {due.length}
        </span>
      </div>
      <div className="flex flex-col">
        {due.length === 0 ? (
          <div className="py-2 text-[12.5px] tracking-[-0.003em] text-fg-3">
            No reviews due today.
          </div>
        ) : (
          <>
            {due.slice(0, 8).map((p) => (
              <DueRow key={p.slug} problem={p} target="_blank" />
            ))}
            {due.length > 8 && (
              <button
                type="button"
                onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL(VIEWER_PATH) })}
                className="mt-1 cursor-pointer self-start rounded border-0 bg-transparent p-0 text-[11.5px] font-medium text-secondary transition-colors duration-100 hover:text-fg"
              >
                View all {due.length} in Problems
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

// ---------- Log a problem ----------

function LogProblem({ onSaved }: { onSaved: () => void }) {
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
    <section className="px-4 pt-4 pb-3" aria-label="Log a problem">
      <SectionLabel icon={<SearchIcon />} className="mb-2">
        Log a problem
      </SectionLabel>

      {!picked && (
        <>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-3" />
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
              className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-[12.5px] text-fg transition-colors duration-100 placeholder:text-fg-3 focus:border-border-2 focus:bg-surface-2 focus:outline-none"
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
                  className={`flex-1 cursor-pointer rounded-md border py-1.5 text-[12.5px] font-medium transition-colors duration-100 ${
                    confidence === n
                      ? 'border-primary bg-primary-dim text-primary'
                      : 'border-border bg-surface text-fg-2 hover:bg-surface-2 hover:text-fg'
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
            className="mb-2.5 min-h-[56px] w-full resize-y rounded-md border border-border bg-surface px-2.5 py-2 text-[12.5px] text-fg transition-colors duration-100 placeholder:text-fg-3 focus:border-border-2 focus:bg-surface-2 focus:outline-none"
          />

          <div className="mb-3 flex gap-4">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-fg-2">
              <input
                type="checkbox"
                checked={needReview}
                onChange={(e) => setNeedReview(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              Need review
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-fg-2">
              <input
                type="checkbox"
                checked={mastered}
                onChange={(e) => setMastered(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              Mastered
            </label>
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
    </section>
  )
}

// ---------- Footer ----------

function FootAuth({
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

function FootGithub({ status }: { status: StatusResponse | null }) {
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
