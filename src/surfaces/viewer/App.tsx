// Viewer — rethought for v2 (SPEC §4): review-queue-first dashboard as
// the landing view, with the full Linear-style problem table one tab
// away. Viewport-locked layout (design.md §7) in table view.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrandIcon, GearIcon, GoogleIcon } from '../../components/icons'
import { Spinner } from '../../components/Spinner'
import { DEFAULT_SETTINGS, DEFAULT_STATE } from '../../engine/storage'
import type { ProblemMap, Settings, State } from '../../engine/types'
import { isMsgError, send } from '../../messages'
import { QueueView } from './QueueView'
import { toRows } from './rows'
import { TableView } from './TableView'

const OPTIONS_PATH = 'src/surfaces/options/index.html'

type View = 'queue' | 'table'

interface ViewerData {
  problems: ProblemMap
  state: State
  settings: Settings
}

function useViewerData() {
  const [data, setData] = useState<ViewerData | null>(null)

  const load = useCallback(async () => {
    const { problems, state, settings } = await chrome.storage.local.get([
      'problems',
      'state',
      'settings',
    ])
    setData({
      problems: problems || {},
      state: { ...DEFAULT_STATE, ...(state || {}) },
      settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
    })
  }, [])

  useEffect(() => {
    load()
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area === 'local' && (changes.problems || changes.state || changes.settings)) load()
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [load])

  return data
}

export function App() {
  const [gate, setGate] = useState<'checking' | 'signedOut' | 'in'>('checking')
  const [view, setView] = useState<View>('queue')
  const [focusSearch, setFocusSearch] = useState(0)
  const data = useViewerData()

  useEffect(() => {
    send({ type: 'getAuthState' }).then((res) => {
      setGate(!isMsgError(res) && res.signedIn ? 'in' : 'signedOut')
    })
  }, [])

  // ⌘K from anywhere: jump to the table and focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setView('table')
        setFocusSearch((n) => n + 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const rows = useMemo(() => toRows(data?.problems ?? {}), [data])

  if (gate === 'checking') return null
  if (gate === 'signedOut') return <AuthGate onSignedIn={() => setGate('in')} />

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.015em] text-fg">
            Problems
          </div>
          <nav aria-label="View" className="flex gap-1">
            <ViewTab active={view === 'queue'} onClick={() => setView('queue')}>
              Queue
            </ViewTab>
            <ViewTab active={view === 'table'} onClick={() => setView('table')}>
              All problems
            </ViewTab>
          </nav>
        </div>
        <a
          href={chrome.runtime.getURL(OPTIONS_PATH)}
          title="Settings"
          aria-label="Settings"
          className="flex h-7 w-7 items-center justify-center rounded-md text-fg-3 transition-colors duration-100 hover:bg-surface-2 hover:text-fg"
        >
          <GearIcon />
        </a>
      </header>

      {!data ? (
        <div className="grid flex-1 place-items-center">
          <Spinner className="text-fg-3" />
        </div>
      ) : view === 'queue' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <QueueView
            rows={rows}
            state={data.state}
            settings={data.settings}
            onOpenTable={() => setView('table')}
          />
        </div>
      ) : (
        <TableView rows={rows} focusSearch={focusSearch} />
      )}
    </div>
  )
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-100 ${
        active
          ? 'border-border-2 bg-surface-2 text-fg'
          : 'border-transparent bg-transparent text-fg-3 hover:text-fg-2'
      }`}
    >
      {children}
    </button>
  )
}

// ---------- auth gate ----------

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
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-[360px] text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-border-2 bg-surface text-fg-2"
        >
          <BrandIcon size={22} />
        </div>
        <h1 className="m-0 mb-2 text-[19px] font-semibold tracking-[-0.02em] text-fg">
          Sign in to view your problems
        </h1>
        <p className="m-0 mb-6 text-[12.5px] leading-[1.55] tracking-[-0.003em] text-fg-3">
          Your tracked work is privately synced to your Google account.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={signIn}
          className="mx-auto flex cursor-pointer items-center gap-2.5 rounded-md border border-border-2 bg-surface-2 px-5 py-2.5 text-[13px] font-semibold tracking-[-0.003em] text-fg transition-colors duration-100 hover:enabled:border-fg-3 hover:enabled:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Spinner /> : <GoogleIcon />}
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>
        {err && (
          <div role="alert" className="mt-4 text-[11.5px] text-hard">
            {err}
          </div>
        )}
      </div>
    </div>
  )
}
