// Options — same settings-cards model as v1, dusk-signal skin, shared
// Dialog for every confirm/notice (SPEC §4, design.md §5.16).

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import {
  BrandIcon,
  GoogleIcon,
  ListIcon,
  LockIcon,
  UserIcon,
  WarningIcon,
} from '../../components/icons'
import { Spinner } from '../../components/Spinner'
import { DEFAULT_SETTINGS, getSettings } from '../../engine/storage'
import type { Settings } from '../../engine/types'
import { isMsgError, send } from '../../messages'

const VIEWER_PATH = 'src/surfaces/viewer/index.html'

type Dlg =
  | null
  | { kind: 'notice'; title: string; body: ReactNode }
  | {
      kind: 'confirm'
      title: string
      body: string
      confirmLabel: string
      danger?: boolean
      onConfirm: () => Promise<void>
    }

const inputCls =
  'rounded-md border border-border bg-bg px-3 py-2 text-[12.5px] text-fg transition-colors duration-100 placeholder:text-fg-3 focus:border-border-2 focus:bg-surface-2 focus:outline-none'
const inputSm = `${inputCls} w-20`
const inputMono = `${inputCls} w-full font-mono tracking-normal`

export function App() {
  const [draft, setDraft] = useState<Settings | null>(null)
  const [dlg, setDlg] = useState<Dlg>(null)
  const [dlgBusy, setDlgBusy] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const hydrate = useCallback(async () => {
    setDraft(await getSettings())
  }, [])

  useEffect(() => {
    hydrate()
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      // Parity with v1: external settings changes re-hydrate the form.
      if (area === 'local' && changes.settings) hydrate()
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [hydrate])

  useEffect(() => {
    const id = location.hash.slice(1)
    if (id) {
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [])

  function flashStatus(text: string, ms = 2000) {
    clearTimeout(statusTimer.current)
    setSaveStatus(text)
    statusTimer.current = setTimeout(() => setSaveStatus(''), ms)
  }

  const notice = useCallback((title: string, body: ReactNode) => {
    setDlg({ kind: 'notice', title, body })
  }, [])

  async function save() {
    if (!draft || saving) return
    setSaving(true)
    try {
      const ladder = draft.intervalLadder.filter((n) => Number.isFinite(n) && n > 0)
      const res = await send({
        type: 'updateSettings',
        patch: {
          dailyQuota: draft.dailyQuota,
          splitReviewQuota: draft.splitReviewQuota,
          newSolveQuota: draft.newSolveQuota,
          reviewQuota: draft.reviewQuota,
          intervalLadder: ladder.length ? ladder : DEFAULT_SETTINGS.intervalLadder,
          blocklist: draft.blocklist,
          overrideEnabled: draft.overrideEnabled,
          overrideCountPerDay: draft.overrideCountPerDay,
          overrideDurationMin: draft.overrideDurationMin,
          overridePhrase: draft.overridePhrase || DEFAULT_SETTINGS.overridePhrase,
          quotaResetHour: draft.quotaResetHour,
        },
      })
      if (isMsgError(res)) {
        notice('Save failed', res.error)
        return
      }
      await hydrate()
      flashStatus('Saved')
    } finally {
      setSaving(false)
    }
  }

  if (!draft) return null
  const patch = (p: Partial<Settings>) => setDraft({ ...draft, ...p })

  return (
    <div className="min-h-screen pb-20">
      <header className="flex items-center justify-between border-b border-border px-8 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.015em] text-fg">
            <BrandIcon className="text-fg-2" />
            Enforcer
          </div>
          <span className="text-[12.5px] text-fg-3">/ Settings</span>
        </div>
        <a
          href={chrome.runtime.getURL(VIEWER_PATH)}
          className="flex items-center gap-1.5 rounded-md border border-border-2 px-3 py-1.5 text-xs font-medium text-fg-2 no-underline transition-colors duration-100 hover:border-fg-3 hover:bg-surface-2 hover:text-fg"
        >
          <ListIcon size={13} />
          Problems
        </a>
      </header>

      <main className="mx-auto flex max-w-[640px] flex-col gap-4 px-6 py-8">
        <div className="mb-2">
          <h1 className="m-0 mb-1 text-[22px] font-semibold tracking-[-0.02em] text-fg">
            Settings
          </h1>
          <p className="m-0 text-[12.5px] tracking-[-0.003em] text-fg-3">
            Configure your daily quota, blocklist, spaced repetition, and sync.
          </p>
        </div>

        <Card title="Daily quota" sub="How many problems unlock your day.">
          <Row label="Problems per day" htmlFor="quota">
            <div className="flex items-center gap-3">
              <input
                id="quota"
                type="range"
                min={1}
                max={5}
                value={draft.dailyQuota}
                onChange={(e) => patch({ dailyQuota: Number(e.target.value) })}
                className="w-36 accent-primary"
              />
              <span className="rounded-md bg-surface-2 px-2 py-1 font-mono text-[11.5px] text-fg-2">
                {draft.dailyQuota} / day
              </span>
            </div>
          </Row>
          <Check
            checked={draft.splitReviewQuota}
            onChange={(v) => patch({ splitReviewQuota: v })}
            label="Separate review quota from new-solve quota"
          />
          {draft.splitReviewQuota && (
            <div className="mt-1 flex flex-col gap-3 border-l-0 pl-6">
              <Row label="New solves / day" htmlFor="new-solve-quota">
                <input
                  id="new-solve-quota"
                  type="number"
                  min={0}
                  max={10}
                  value={draft.newSolveQuota}
                  onChange={(e) => patch({ newSolveQuota: numOr(e.target.value, 1) })}
                  className={inputSm}
                />
              </Row>
              <Row label="Reviews / day" htmlFor="review-quota">
                <input
                  id="review-quota"
                  type="number"
                  min={0}
                  max={10}
                  value={draft.reviewQuota}
                  onChange={(e) => patch({ reviewQuota: numOr(e.target.value, 0) })}
                  className={inputSm}
                />
              </Row>
            </div>
          )}
        </Card>

        <Card title="Blocklist" sub="Sites that redirect to the block page until quota is met.">
          <BlocklistEditor
            blocklist={draft.blocklist}
            onChange={(blocklist) => patch({ blocklist })}
          />
        </Card>

        <Card
          title="Spaced repetition"
          sub="The interval ladder a problem walks up after each clean review."
        >
          <Row label="Interval ladder (days)" htmlFor="ladder">
            <LadderInput
              value={draft.intervalLadder}
              onChange={(intervalLadder) => patch({ intervalLadder })}
            />
          </Row>
        </Card>

        <Card title="Emergency override" sub="Type a phrase to temporarily bypass the block.">
          <Check
            checked={draft.overrideEnabled}
            onChange={(v) => patch({ overrideEnabled: v })}
            label="Enable override"
          />
          <Row label="Uses per day" htmlFor="override-count">
            <input
              id="override-count"
              type="number"
              min={0}
              max={10}
              value={draft.overrideCountPerDay}
              onChange={(e) => patch({ overrideCountPerDay: numOr(e.target.value, 1) })}
              className={inputSm}
            />
          </Row>
          <Row label="Duration (minutes)" htmlFor="override-duration">
            <input
              id="override-duration"
              type="number"
              min={1}
              max={120}
              value={draft.overrideDurationMin}
              onChange={(e) => patch({ overrideDurationMin: numOr(e.target.value, 10) })}
              className={inputSm}
            />
          </Row>
          <Row label="Passphrase" htmlFor="override-phrase" wide>
            <input
              id="override-phrase"
              type="text"
              value={draft.overridePhrase}
              onChange={(e) => patch({ overridePhrase: e.target.value })}
              className={`${inputCls} w-full`}
            />
          </Row>
        </Card>

        <Card title="Schedule" sub="When the day rolls over and counters reset.">
          <Row label="Reset hour (0–23, local)" htmlFor="reset-hour">
            <input
              id="reset-hour"
              type="number"
              min={0}
              max={23}
              value={draft.quotaResetHour}
              onChange={(e) => patch({ quotaResetHour: numOr(e.target.value, 3) })}
              className={inputSm}
            />
          </Row>
        </Card>

        <GithubCard settings={draft} notice={notice} setDlg={setDlg} onChanged={hydrate} />
        <HistoryCard />
        <AccountCard notice={notice} setDlg={setDlg} onChanged={hydrate} />

        <Card
          title="Reset"
          sub="Wipe all local data. Your Supabase records are not deleted."
          danger
        >
          <div>
            <Button
              variant="danger"
              onClick={() =>
                setDlg({
                  kind: 'confirm',
                  title: 'Reset all data?',
                  body: 'Wipes all local data on this device — problems, streak, settings, and saved tokens. Your Supabase records are not deleted. This cannot be undone.',
                  confirmLabel: 'Reset all data',
                  danger: true,
                  onConfirm: async () => {
                    await send({ type: 'resetAll' })
                    await hydrate()
                    flashStatus('Reset complete', 3000)
                  },
                })
              }
            >
              Reset all data
            </Button>
          </div>
        </Card>
      </main>

      <footer className="fixed inset-x-0 bottom-0 flex items-center justify-end gap-4 border-t border-border bg-bg/95 px-8 py-3 backdrop-blur-sm">
        <span aria-live="polite" className="text-xs text-fg-3">
          {saveStatus}
        </span>
        <Button variant="primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </footer>

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
        <div className="m-0 mb-3.5 text-[12.5px] leading-[1.55] tracking-[-0.003em] text-fg-2">
          {dlg?.kind === 'notice' ? dlg.body : null}
        </div>
      </Dialog>

      <Dialog
        open={dlg?.kind === 'confirm'}
        onClose={() => setDlg(null)}
        title={dlg?.kind === 'confirm' ? dlg.title : ''}
        mark={
          dlg?.kind === 'confirm' && dlg.danger ? <WarningIcon size={14} /> : <LockIcon size={14} />
        }
        markTone={dlg?.kind === 'confirm' && dlg.danger ? 'warning' : 'neutral'}
        actions={
          <>
            <Button
              variant="ghost"
              data-autofocus={dlg?.kind === 'confirm' && dlg.danger ? true : undefined}
              onClick={() => setDlg(null)}
            >
              Cancel
            </Button>
            <Button
              variant={dlg?.kind === 'confirm' && dlg.danger ? 'danger' : 'primary'}
              disabled={dlgBusy}
              onClick={async () => {
                if (dlg?.kind !== 'confirm') return
                setDlgBusy(true)
                try {
                  await dlg.onConfirm()
                } finally {
                  setDlgBusy(false)
                  setDlg(null)
                }
              }}
            >
              {dlg?.kind === 'confirm' ? dlg.confirmLabel : ''}
            </Button>
          </>
        }
      >
        <p className="m-0 mb-3.5 text-[12.5px] leading-[1.55] tracking-[-0.003em] text-fg-2">
          {dlg?.kind === 'confirm' ? dlg.body : ''}
        </p>
      </Dialog>
    </div>
  )
}

// ---------- Card + form primitives ----------

function Card({
  title,
  sub,
  danger,
  children,
  id,
  tag,
}: {
  title: string
  sub: ReactNode
  danger?: boolean
  children: ReactNode
  id?: string
  tag?: string
}) {
  return (
    <section
      id={id}
      className={`rounded-xl border bg-surface p-5 ${danger ? 'border-[rgba(239,111,108,0.3)]' : 'border-border'}`}
    >
      <header className="mb-4">
        <h2 className="m-0 mb-1 flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.01em] text-fg">
          {title}
          {tag && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium tracking-wide text-fg-3">
              {tag}
            </span>
          )}
        </h2>
        <p className="m-0 text-[11.5px] leading-[1.5] tracking-[-0.003em] text-fg-3">{sub}</p>
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Row({
  label,
  htmlFor,
  children,
  wide,
}: {
  label: string
  htmlFor: string
  children: ReactNode
  wide?: boolean
}) {
  if (wide) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={htmlFor} className="text-[12.5px] tracking-[-0.003em] text-fg-2">
          {label}
        </label>
        {children}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={htmlFor} className="text-[12.5px] tracking-[-0.003em] text-fg-2">
        {label}
      </label>
      {children}
    </div>
  )
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] tracking-[-0.003em] text-fg-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-primary"
      />
      {label}
    </label>
  )
}

function numOr(val: string, fallback: number): number {
  const n = Number.parseInt(val, 10)
  return Number.isFinite(n) ? n : fallback
}

// ---------- Blocklist ----------

function BlocklistEditor({
  blocklist,
  onChange,
}: {
  blocklist: string[]
  onChange: (next: string[]) => void
}) {
  const [value, setValue] = useState('')

  function add() {
    const v = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
    if (!v || blocklist.includes(v)) return
    onChange([...blocklist, v])
    setValue('')
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {blocklist.map((d) => (
          <span
            key={d}
            className="flex items-center gap-1 rounded-full border border-border bg-surface-2 py-1 pr-1.5 pl-2.5 text-xs text-fg-2"
          >
            {d}
            <button
              type="button"
              title={`Remove ${d}`}
              aria-label={`Remove ${d}`}
              onClick={() => onChange(blocklist.filter((x) => x !== d))}
              className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-fg-3 transition-colors duration-100 hover:bg-surface-3 hover:text-fg"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          placeholder="example.com"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          className={`${inputCls} flex-1`}
        />
        <Button variant="outline" onClick={add}>
          Add
        </Button>
      </div>
    </>
  )
}

// ---------- Interval ladder ----------

function LadderInput({
  value,
  onChange,
}: {
  value: number[]
  onChange: (ladder: number[]) => void
}) {
  const [text, setText] = useState(value.join(', '))
  const lastValue = useRef(value)

  // Re-sync the text when the ladder changes from outside (hydrate).
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value
      setText(value.join(', '))
    }
  }, [value])

  return (
    <input
      id="ladder"
      type="text"
      value={text}
      placeholder="1, 3, 7, 14, 30"
      onChange={(e) => {
        setText(e.target.value)
        const ladder = e.target.value
          .split(',')
          .map((s) => Number.parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
        lastValue.current = ladder
        onChange(ladder)
      }}
      className={`${inputMono} max-w-[240px]`}
    />
  )
}

// ---------- GitHub ----------

function GithubCard({
  settings,
  notice,
  setDlg,
  onChanged,
}: {
  settings: Settings
  notice: (title: string, body: ReactNode) => void
  setDlg: (d: Dlg) => void
  onChanged: () => Promise<void>
}) {
  const [mode, setMode] = useState<'oauth' | 'pat'>('oauth')
  const [clientId, setClientId] = useState(settings.githubClientId ?? '')
  const [oauthRepo, setOauthRepo] = useState(settings.githubRepo || 'leetcode-enforcer-solutions')
  const [token, setToken] = useState('')
  const [patRepo, setPatRepo] = useState(settings.githubRepo || 'leetcode-enforcer-solutions')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ userCode: string; url: string } | null>(null)
  const [pollStatus, setPollStatus] = useState('')
  const [lastCommitUrl, setLastCommitUrl] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const connected = !!(settings.githubEnabled && settings.githubToken)

  useEffect(() => {
    chrome.storage.local.get('state').then(({ state }) => {
      setLastCommitUrl(state?.lastGithubCommitUrl ?? null)
    })
  }, [])

  useEffect(() => () => clearInterval(pollRef.current), [])

  function stopPolling() {
    clearInterval(pollRef.current)
    pollRef.current = undefined
  }

  async function startOauth() {
    const id = clientId.trim()
    if (!id) {
      notice('Client ID required', 'Paste your OAuth App Client ID first.')
      return
    }
    setBusy(true)
    const res = await send({ type: 'githubStartOauth', clientId: id })
    setBusy(false)
    if (isMsgError(res) || !res.ok) {
      notice(
        "Couldn't start authorization",
        (isMsgError(res) ? res.error : res.error) || 'Unknown error.',
      )
      return
    }
    const url = res.verificationUriComplete || res.verificationUri
    setPending({ userCode: res.userCode, url })
    setPollStatus('Waiting for you to authorize on GitHub…')
    window.open(url, '_blank')
    const repoName = oauthRepo.trim() || 'leetcode-enforcer-solutions'
    stopPolling()
    pollRef.current = setInterval(async () => {
      const check = await send({ type: 'githubCheckOauth', repoName })
      if (isMsgError(check) || !check.ok) {
        stopPolling()
        setPollStatus(`Error: ${isMsgError(check) ? check.error : check.error}`)
        return
      }
      if (check.pending) {
        setPollStatus('Waiting for you to authorize on GitHub…')
        return
      }
      stopPolling()
      setPending(null)
      await onChanged() // connected status row is the confirmation
    }, 3000)
  }

  async function cancelOauth() {
    stopPolling()
    await send({ type: 'githubCancelOauth' })
    setPending(null)
  }

  async function connectPat() {
    const t = token.trim()
    if (!t) {
      notice('Token required', 'Paste a fine-grained personal access token first.')
      return
    }
    setBusy(true)
    const res = await send({
      type: 'connectGithub',
      token: t,
      repoName: patRepo.trim() || 'leetcode-enforcer-solutions',
    })
    setBusy(false)
    if (isMsgError(res) || !res.ok) {
      notice(
        'GitHub connection failed',
        (isMsgError(res) ? res.error : res.error) || 'Unknown error.',
      )
      return
    }
    setToken('')
    await onChanged()
  }

  const tabCls = (active: boolean) =>
    `cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-100 ${
      active
        ? 'border-border-2 bg-surface-2 text-fg'
        : 'border-transparent bg-transparent text-fg-3 hover:text-fg-2'
    }`

  return (
    <Card
      id="github"
      title="GitHub sync"
      tag="optional"
      sub={
        <>
          Pushes each accepted submission to a <strong>private</strong> repo (auto-created if
          missing). One commit per submission.
        </>
      }
    >
      {connected ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-[12.5px] text-fg-2">
              <UserIcon className="text-fg-3" />
              Connected as{' '}
              <strong className="font-semibold text-fg">{settings.githubOwner || '?'}</strong>
            </span>
            {settings.githubRepoUrl && (
              <a
                href={settings.githubRepoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-secondary no-underline hover:underline"
              >
                Open repo
              </a>
            )}
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              onClick={async () => {
                const res = await send({ type: 'testGithub' })
                if (!isMsgError(res) && res.ok) {
                  notice('GitHub connected', `Authenticated as ${res.login}.`)
                } else {
                  notice(
                    'GitHub test failed',
                    (isMsgError(res) ? res.error : res.error) || 'Unknown error.',
                  )
                }
              }}
            >
              Test
            </Button>
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              onClick={() =>
                setDlg({
                  kind: 'confirm',
                  title: 'Disconnect GitHub?',
                  body: 'Removes the saved token from this device. The repo and its commits are kept.',
                  confirmLabel: 'Disconnect',
                  onConfirm: async () => {
                    await send({ type: 'disconnectGithub' })
                    await onChanged()
                  },
                })
              }
            >
              Disconnect
            </Button>
          </div>
          {lastCommitUrl && (
            <div className="text-[11.5px] text-fg-3">
              Last commit:{' '}
              <a
                href={lastCommitUrl}
                target="_blank"
                rel="noreferrer"
                className="text-secondary no-underline hover:underline"
              >
                view
              </a>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={tabCls(mode === 'oauth')}
              onClick={() => setMode('oauth')}
            >
              OAuth (recommended)
            </button>
            <button type="button" className={tabCls(mode === 'pat')} onClick={() => setMode('pat')}>
              Personal access token
            </button>
          </div>

          {mode === 'oauth' ? (
            <>
              <p className="m-0 text-[11.5px] leading-[1.55] text-fg-3">
                One-time setup: register a GitHub OAuth App at{' '}
                <a
                  href="https://github.com/settings/applications/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-secondary no-underline hover:underline"
                >
                  github.com/settings/applications/new
                </a>
                . Set Homepage URL to anything (e.g.{' '}
                <code className="font-mono text-fg-2">http://localhost</code>), check{' '}
                <strong>Enable Device Flow</strong>, then copy the <strong>Client ID</strong>.
              </p>
              <Row label="Client ID" htmlFor="gh-client-id" wide>
                <input
                  id="gh-client-id"
                  type="text"
                  value={clientId}
                  placeholder="Iv1.abcd… or 1234abcd…"
                  onChange={(e) => setClientId(e.target.value)}
                  className={inputMono}
                />
              </Row>
              <Row label="Repo name" htmlFor="gh-oauth-repo" wide>
                <input
                  id="gh-oauth-repo"
                  type="text"
                  value={oauthRepo}
                  onChange={(e) => setOauthRepo(e.target.value)}
                  className={`${inputCls} w-full`}
                />
              </Row>
              {!pending ? (
                <div>
                  <Button variant="primary" disabled={busy} onClick={startOauth}>
                    {busy ? 'Starting…' : 'Authorize via GitHub'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg p-4">
                  <p className="m-0 text-[11.5px] text-fg-3">
                    Enter this code on the GitHub page that opens:
                  </p>
                  <div className="font-mono text-[22px] font-medium tracking-[0.12em] text-fg">
                    {pending.userCode}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={pending.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-primary bg-primary px-4 py-2 text-[12.5px] font-semibold text-bg no-underline transition-colors duration-100 hover:border-[#FF8456] hover:bg-[#FF8456]"
                    >
                      Open GitHub
                    </a>
                    <Button variant="ghost" onClick={cancelOauth}>
                      Cancel
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
                    {pollStatus.startsWith('Waiting') && <Spinner className="h-2.5 w-2.5" />}
                    {pollStatus}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <Row label="Personal access token" htmlFor="gh-token" wide>
                <input
                  id="gh-token"
                  type="password"
                  value={token}
                  placeholder="github_pat_… or ghp_…"
                  onChange={(e) => setToken(e.target.value)}
                  className={inputMono}
                />
              </Row>
              <Row label="Repo name" htmlFor="gh-repo" wide>
                <input
                  id="gh-repo"
                  type="text"
                  value={patRepo}
                  onChange={(e) => setPatRepo(e.target.value)}
                  className={`${inputCls} w-full`}
                />
              </Row>
              <div className="flex items-center gap-3">
                <Button variant="primary" disabled={busy} onClick={connectPat}>
                  {busy ? 'Connecting…' : 'Connect GitHub'}
                </Button>
                <a
                  href="https://github.com/settings/tokens?type=beta"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-secondary no-underline hover:underline"
                >
                  Create a fine-grained PAT
                </a>
              </div>
              <div className="text-[11.5px] leading-[1.55] text-fg-3">
                Required scope:{' '}
                <code className="font-mono text-fg-2">Contents: Read and write</code> ·{' '}
                <code className="font-mono text-fg-2">Administration: Read and write</code> (to
                create the repo).
              </div>
            </>
          )}
        </>
      )}
    </Card>
  )
}

// ---------- LeetCode history ----------

function HistoryCard() {
  const [login, setLogin] = useState<'checking' | { username: string } | 'signedOut'>('checking')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    send({ type: 'getLeetcodeLoginStatus' }).then((res) => {
      if (!isMsgError(res) && res.isSignedIn && res.username) setLogin({ username: res.username })
      else setLogin('signedOut')
    })
  }, [])

  async function runImport() {
    setBusy(true)
    setStatus('Importing…')
    const res = await send({ type: 'importLeetcodeHistory' })
    setBusy(false)
    if (isMsgError(res) || !res.ok) {
      setStatus(`Failed: ${(isMsgError(res) ? res.error : res.error) || 'unknown'}`)
    } else {
      setStatus(`Imported ${res.imported} problems as Mastered`)
    }
  }

  return (
    <Card
      id="history"
      title="LeetCode history"
      sub="Pull your accepted submissions. New entries are added as Mastered with no SRS impact."
    >
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={busy || typeof login !== 'object'} onClick={runImport}>
          {busy ? 'Importing…' : 'Import history'}
        </Button>
        <span aria-live="polite" className="text-[11.5px] text-fg-3">
          {status}
        </span>
      </div>
      <div className="text-[11.5px] text-fg-3">
        {login === 'checking' ? (
          'Checking LeetCode login…'
        ) : typeof login === 'object' ? (
          `Signed in to LeetCode as @${login.username}.`
        ) : (
          <>
            Not signed into LeetCode —{' '}
            <a
              href="https://leetcode.com/accounts/login/"
              target="_blank"
              rel="noreferrer"
              className="text-secondary no-underline hover:underline"
            >
              sign in
            </a>
            , then reload this page.
          </>
        )}
      </div>
    </Card>
  )
}

// ---------- Account ----------

function AccountCard({
  notice,
  setDlg,
  onChanged,
}: {
  notice: (title: string, body: ReactNode) => void
  setDlg: (d: Dlg) => void
  onChanged: () => Promise<void>
}) {
  const [auth, setAuth] = useState<{ signedIn: boolean; email?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [syncLabel, setSyncLabel] = useState('Force re-sync')

  const refresh = useCallback(async () => {
    const res = await send({ type: 'getAuthState' })
    setAuth(isMsgError(res) ? { signedIn: false } : res)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <Card
      id="account"
      title="Account"
      sub="Sign in with Google to sync your progress. Your data stays private to your account."
    >
      {auth?.signedIn ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-[12.5px] text-fg-2">
            <UserIcon className="text-fg-3" />
            Signed in as{' '}
            <strong className="font-semibold text-fg">{auth.email || '(unknown)'}</strong>
          </span>
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setSyncLabel('Syncing…')
              const res = await send({ type: 'forceSyncAll' })
              setBusy(false)
              if (isMsgError(res) || !res.ok) {
                setSyncLabel('Force re-sync')
                notice('Sync failed', (isMsgError(res) ? res.error : res.error) || 'Unknown error.')
              } else {
                setSyncLabel('Synced')
                setTimeout(() => setSyncLabel('Force re-sync'), 1500)
              }
            }}
          >
            {syncLabel}
          </Button>
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            onClick={() =>
              setDlg({
                kind: 'confirm',
                title: 'Sign out?',
                body: 'Your local data stays on this device.',
                confirmLabel: 'Sign out',
                onConfirm: async () => {
                  await send({ type: 'signOut' })
                  await refresh()
                  await onChanged()
                },
              })
            }
          >
            Sign out
          </Button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const res = await send({ type: 'signInGoogle' })
              setBusy(false)
              if (isMsgError(res) || !res.ok) {
                notice(
                  'Sign-in failed',
                  (isMsgError(res) ? res.error : res.error) || 'Unknown error.',
                )
                return
              }
              await refresh()
              await onChanged()
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border-2 bg-surface-2 px-4 py-2 text-[12.5px] font-semibold text-fg transition-colors duration-100 hover:enabled:border-fg-3 hover:enabled:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Spinner /> : <GoogleIcon size={14} />}
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </button>
        </div>
      )}
    </Card>
  )
}
