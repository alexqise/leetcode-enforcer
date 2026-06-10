// Popup — auth gate + dialogs shell; the main layout lives in PopupMain.

import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import {
  BrandIcon,
  CheckSquareIcon,
  ClockIcon,
  CubeIcon,
  GoogleIcon,
  LockIcon,
} from '../../components/icons'
import { Spinner } from '../../components/Spinner'
import { useStatus } from '../../hooks/useStatus'
import { isMsgError, send } from '../../messages'
import { PopupMain } from './PopupMain'

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
        className="mb-6 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border-0 bg-surface-2 px-4 py-2.5 text-[13px] font-semibold tracking-[-0.003em] text-fg transition-colors duration-100 hover:enabled:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-60"
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

// ---------- Main shell (data + dialogs; layout delegated) ----------

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
    <>
      <PopupMain
        status={status}
        refresh={refresh}
        onSignOutClick={() => setDlg({ kind: 'signOutConfirm' })}
      />

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
    </>
  )
}
