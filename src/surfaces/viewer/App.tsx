// Viewer — open problems document under a banner header (design.md §5.15,
// §7). The full sortable/filterable table is the surface; no queue tab.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BannerScene } from '../../components/BannerScene'
import { BrandIcon, GearIcon, GoogleIcon } from '../../components/icons'
import { Spinner } from '../../components/Spinner'
import { DEFAULT_SETTINGS, DEFAULT_STATE } from '../../engine/storage'
import type { ProblemMap, Settings, State } from '../../engine/types'
import { isMsgError, send } from '../../messages'
import { toRows } from './rows'
import { TableView } from './TableView'

const OPTIONS_PATH = 'src/surfaces/options/index.html'

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
  const [focusSearch, setFocusSearch] = useState(0)
  const data = useViewerData()
  const rows = useMemo(() => toRows(data?.problems ?? {}), [data])

  useEffect(() => {
    send({ type: 'getAuthState' }).then((res) => {
      setGate(!isMsgError(res) && res.signedIn ? 'in' : 'signedOut')
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFocusSearch((n) => n + 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (gate === 'checking') return null
  if (gate === 'signedOut') return <AuthGate onSignedIn={() => setGate('in')} />

  return (
    <div className="flex min-h-screen flex-col">
      <BannerScene>
        <header className="absolute inset-x-0 top-0 flex items-center justify-between px-10 py-5 max-sm:px-5 max-sm:py-4">
          <span className="text-[13.5px] font-semibold tracking-[-0.015em] text-[#F4F1F6]">
            Problems
          </span>
          <div className="flex items-center gap-3">
            {data && (
              <span className="rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(22,18,22,0.45)] px-2.5 py-1 text-[11px] font-medium tracking-[-0.003em] text-[#F4F1F6] backdrop-blur-[6px]">
                {rows.length} tracked
              </span>
            )}
            <a
              href={chrome.runtime.getURL(OPTIONS_PATH)}
              title="Settings"
              aria-label="Settings"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[rgba(244,241,246,0.65)] transition-colors duration-100 hover:bg-[rgba(255,255,255,0.08)] hover:text-[#F4F1F6]"
            >
              <GearIcon />
            </a>
          </div>
        </header>
      </BannerScene>

      {!data ? (
        <div className="grid min-h-[40vh] place-items-center">
          <Spinner className="text-fg-3" />
        </div>
      ) : (
        <TableView rows={rows} focusSearch={focusSearch} />
      )}
    </div>
  )
}

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
      <div className="max-w-[440px] text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-border-2 bg-surface text-fg-2"
        >
          <BrandIcon size={22} />
        </div>
        <h1 className="m-0 mb-2 text-[22px] font-semibold tracking-[-0.02em] text-fg">
          Sign in to view your problems
        </h1>
        <p className="m-0 mb-7 text-[13.5px] leading-[1.55] tracking-[-0.003em] text-fg-2">
          Your tracked work is privately synced to your Google account.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={signIn}
          className="mx-auto flex cursor-pointer items-center gap-2.5 rounded-md border border-border-2 bg-fg px-5 py-2.5 text-[14px] font-semibold tracking-[-0.003em] text-bg transition-colors duration-100 hover:enabled:bg-[#FFFCF7] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Spinner /> : <GoogleIcon />}
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>
        {err && (
          <div
            role="alert"
            className="mx-auto mt-4 max-w-[360px] rounded-md border border-[rgba(239,111,108,0.2)] bg-[rgba(239,111,108,0.08)] px-3 py-2 text-[11.5px] text-hard"
          >
            {err}
          </div>
        )}
      </div>
    </div>
  )
}
