// Options — an open settings document (user-directed rework, 2026-06-10):
// onboarding's type scale and rhythm, no cards, hairline-paced sections,
// label-column form grid, auto-save (no save bar). Shared Dialog for
// every confirm/notice (design.md §5.16).

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { GoogleIcon, ListIcon, LockIcon, UserIcon, WarningIcon } from '../../components/icons'
import { Slider } from '../../components/Slider'
import { Spinner } from '../../components/Spinner'
import { Switch } from '../../components/Switch'
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
  'cursor-text rounded-none border-0 border-b border-border bg-surface/50 px-2 py-1.5 text-[13px] text-fg transition-colors duration-100 placeholder:text-fg-3 focus:border-fg-3 focus:outline-none'
const inputSm = `${inputCls} w-12 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`
const inputMono = `${inputCls}  `

export function App() {
  const [draft, setDraft] = useState<Settings | null>(null)
  const [dlg, setDlg] = useState<Dlg>(null)
  const [dlgBusy, setDlgBusy] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const hydrate = useCallback(async () => {
    setDraft(await getSettings())
  }, [])

  // Initial load only. No storage.onChanged re-hydrate: with auto-save this
  // page is the writer, and re-hydrating on our own round-trips would
  // clobber in-flight typing.
  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    const id = location.hash.slice(1)
    if (id) {
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  function flashStatus(text: string, ms = 1800) {
    clearTimeout(statusTimer.current)
    setSaveStatus(text)
    statusTimer.current = setTimeout(() => setSaveStatus(''), ms)
  }

  const notice = useCallback((title: string, body: ReactNode) => {
    setDlg({ kind: 'notice', title, body })
  }, [])

  async function persist(d: Settings) {
    const ladder = d.intervalLadder.filter((n) => Number.isFinite(n) && n > 0)
    const res = await send({
      type: 'updateSettings',
      patch: {
        dailyQuota: d.dailyQuota,
        splitReviewQuota: d.splitReviewQuota,
        newSolveQuota: d.newSolveQuota,
        reviewQuota: d.reviewQuota,
        intervalLadder: ladder.length ? ladder : DEFAULT_SETTINGS.intervalLadder,
        blocklist: d.blocklist,
        overrideEnabled: d.overrideEnabled,
        overrideCountPerDay: d.overrideCountPerDay,
        overrideDurationMin: d.overrideDurationMin,
        overridePhrase: d.overridePhrase || DEFAULT_SETTINGS.overridePhrase,
        quotaResetHour: d.quotaResetHour,
      },
    })
    if (isMsgError(res)) {
      notice('Save failed', res.error)
      return
    }
    flashStatus('Saved')
  }

  if (!draft) return null

  // Auto-save: every change persists after a short debounce.
  const patch = (p: Partial<Settings>) => {
    const next = { ...draft, ...p }
    setDraft(next)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(next), 600)
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="mx-auto flex max-w-[680px] items-center justify-between px-6 pt-8">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.015em] text-fg">
          Enforcer
        </div>
        <div className="flex items-center gap-5">
          <span
            aria-live="polite"
            className={`text-xs text-fg-3 transition-opacity duration-300 ${saveStatus ? 'opacity-100' : 'opacity-0'}`}
          >
            {saveStatus || 'Saved'}
          </span>
          <a
            href={chrome.runtime.getURL(VIEWER_PATH)}
            className="flex items-center gap-1.5 text-xs font-medium text-fg-3 no-underline transition-colors duration-100 hover:text-fg"
          >
            <ListIcon size={13} />
            Problems
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-[680px] flex-col gap-9 px-6 pt-12 pb-10">
        <div>
          <h1 className="m-0 mb-2 text-[26px] font-semibold tracking-[-0.025em] text-fg">
            Settings
          </h1>
          <p className="m-0 max-w-[46ch] text-[13.5px] leading-[1.6] tracking-[-0.003em] text-fg-2">
            Your daily quota, blocklist, spaced repetition, and sync. Changes save automatically.
          </p>
        </div>

        <Section title="Daily quota" sub="How many problems unlock your day.">
          <Row label="Problems per day">
            <div className="flex items-center gap-4">
              <Slider
                aria-label="Problems per day"
                value={draft.dailyQuota}
                onChange={(dailyQuota) => patch({ dailyQuota })}
                min={1}
                max={5}
                className="w-44"
              />
              <span className="text-[13px] text-fg">
                {draft.dailyQuota} <span className="text-fg-3">/ day</span>
              </span>
            </div>
          </Row>
          <Row label="Split quotas" hint="Track reviews and new solves separately.">
            <Switch
              checked={draft.splitReviewQuota}
              onChange={(splitReviewQuota) => patch({ splitReviewQuota })}
              aria-label="Separate review quota from new-solve quota"
            />
          </Row>
          {draft.splitReviewQuota && (
            <>
              <Row label="New solves / day">
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={draft.newSolveQuota}
                  onChange={(e) => patch({ newSolveQuota: numOr(e.target.value, 1) })}
                  aria-label="New solves per day"
                  className={inputSm}
                />
              </Row>
              <Row label="Reviews / day">
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={draft.reviewQuota}
                  onChange={(e) => patch({ reviewQuota: numOr(e.target.value, 0) })}
                  aria-label="Reviews per day"
                  className={inputSm}
                />
              </Row>
            </>
          )}
        </Section>

        <Section title="Blocklist" sub="Sites that redirect to the block page until quota is met.">
          <BlocklistEditor
            blocklist={draft.blocklist}
            onChange={(blocklist) => patch({ blocklist })}
          />
        </Section>

        <Section
          title="Spaced repetition"
          sub="The interval ladder a problem walks up after each clean review."
        >
          <Row label="Interval ladder" hint="Days between reviews.">
            <LadderInput
              value={draft.intervalLadder}
              onChange={(intervalLadder) => patch({ intervalLadder })}
            />
          </Row>
        </Section>

        <Section title="Emergency override" sub="Type a phrase to temporarily bypass the block.">
          <Row label="Enable override">
            <Switch
              checked={draft.overrideEnabled}
              onChange={(overrideEnabled) => patch({ overrideEnabled })}
              aria-label="Enable override"
            />
          </Row>
          <Row label="Uses per day">
            <input
              type="number"
              min={0}
              max={10}
              value={draft.overrideCountPerDay}
              onChange={(e) => patch({ overrideCountPerDay: numOr(e.target.value, 1) })}
              aria-label="Override uses per day"
              className={inputSm}
            />
          </Row>
          <Row label="Duration">
            <div className="flex items-baseline gap-2.5">
              <input
                type="number"
                min={1}
                max={120}
                value={draft.overrideDurationMin}
                onChange={(e) => patch({ overrideDurationMin: numOr(e.target.value, 10) })}
                aria-label="Override duration in minutes"
                className={inputSm}
              />
              <span className="text-xs text-fg-3">minutes</span>
            </div>
          </Row>
          <Row label="Passphrase">
            <input
              type="text"
              value={draft.overridePhrase}
              onChange={(e) => patch({ overridePhrase: e.target.value })}
              aria-label="Override passphrase"
              className={`${inputCls} w-full max-w-[380px]`}
            />
          </Row>
        </Section>

        <Section title="Schedule" sub="When the day rolls over and counters reset.">
          <Row label="Reset hour" hint="0–23, local time.">
            <input
              type="number"
              min={0}
              max={23}
              value={draft.quotaResetHour}
              onChange={(e) => patch({ quotaResetHour: numOr(e.target.value, 3) })}
              aria-label="Reset hour"
              className={inputSm}
            />
          </Row>
        </Section>

        <GithubSection settings={draft} notice={notice} setDlg={setDlg} onChanged={hydrate} />
        <HistorySection />
        <AccountSection notice={notice} setDlg={setDlg} onChanged={hydrate} />

        <Section title="Reset" sub="Wipe all local data. Your Supabase records are not deleted.">
          <div>
            <Button
              variant="raised-danger"
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
        </Section>
      </main>

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

// ---------- Section + form primitives ----------

/**
 * Open settings section (no card box, per principle 7): heading + hint
 * carry the grouping; a hairline above each section after the first
 * paces the document.
 */
function Section({
  title,
  sub,
  children,
  id,
  tag,
}: {
  title: string
  sub: ReactNode
  children: ReactNode
  id?: string
  tag?: string
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 border-t border-border pt-9 [&:first-of-type]:border-t-0 [&:first-of-type]:pt-0"
    >
      <header className="mb-6">
        <h2 className="m-0 mb-1.5 flex items-baseline gap-2.5 text-[16px] font-semibold tracking-[-0.015em] text-fg">
          {title}
          {tag && (
            <span className="text-[11px] font-normal tracking-[-0.003em] text-fg-3">{tag}</span>
          )}
        </h2>
        <p className="m-0 max-w-[48ch] text-[12.5px] leading-[1.55] tracking-[-0.003em] text-fg-3">
          {sub}
        </p>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

/**
 * Form-grid row: fixed label column, left-aligned control column with
 * content-fitted widths — never full-bleed inputs.
 */
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-x-6">
      <div>
        <div className="text-[13px] tracking-[-0.003em] text-fg-2">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] tracking-[-0.003em] text-fg-3">{hint}</div>}
      </div>
      <div className="flex min-w-0 items-center justify-end">{children}</div>
    </div>
  )
}

/** Segmented mode switch (two options in a soft pill container). */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-lg bg-surface p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`cursor-pointer rounded-md border-0 px-3 py-1.5 text-[12.5px] font-medium tracking-[-0.003em] transition-colors duration-100 ${
            value === o.value ? 'bg-surface-3 text-fg' : 'bg-transparent text-fg-3 hover:text-fg-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
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
            className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1.5 pl-2.5 text-xs text-fg-2"
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
          aria-label="Add a site to the blocklist"
          className={`${inputCls} w-[280px]`}
        />
        <Button variant="raised" className="shrink-0" onClick={add}>
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
      type="text"
      value={text}
      placeholder="1, 3, 7, 14, 30"
      aria-label="Interval ladder in days"
      onChange={(e) => {
        setText(e.target.value)
        const ladder = e.target.value
          .split(',')
          .map((s) => Number.parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
        lastValue.current = ladder
        onChange(ladder)
      }}
      className={`${inputMono} w-[200px]`}
    />
  )
}

// ---------- GitHub ----------

function GithubSection({
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

  return (
    <Section
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
            <span className="flex items-center gap-1.5 text-[13px] text-fg-2">
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
          <Row label="Method">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'oauth', label: 'OAuth' },
                { value: 'pat', label: 'Access token' },
              ]}
            />
          </Row>

          {mode === 'oauth' ? (
            <>
              <Row label="Client ID" hint="From your GitHub OAuth App.">
                <input
                  type="text"
                  value={clientId}
                  placeholder="Iv1.abcd… or 1234abcd…"
                  onChange={(e) => setClientId(e.target.value)}
                  aria-label="GitHub OAuth App client ID"
                  className={`${inputMono} w-full max-w-[300px]`}
                />
              </Row>
              <Row label="Repo name">
                <input
                  type="text"
                  value={oauthRepo}
                  onChange={(e) => setOauthRepo(e.target.value)}
                  aria-label="Repository name"
                  className={`${inputCls} w-full max-w-[300px]`}
                />
              </Row>
              {!pending ? (
                <div className="mt-2">
                  <Button variant="raised" className="w-full" disabled={busy} onClick={startOauth}>
                    {busy ? 'Starting…' : 'Authorize via GitHub'}
                  </Button>
                </div>
              ) : (
                <Row label="Device code" hint="Enter on the GitHub page that opens.">
                  <div className="flex flex-col gap-3">
                    <div className="text-[24px] font-medium tracking-[0.14em] text-fg">
                      {pending.userCode}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="raised"
                        onClick={() => window.open(pending.url, '_blank', 'noopener,noreferrer')}
                      >
                        Open GitHub
                      </Button>
                      <Button variant="ghost" onClick={cancelOauth}>
                        Cancel
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
                      {pollStatus.startsWith('Waiting') && <Spinner className="h-2.5 w-2.5" />}
                      {pollStatus}
                    </div>
                  </div>
                </Row>
              )}
              <p className="m-0 mt-1 max-w-[58ch] text-[11.5px] leading-[1.55] tracking-[-0.003em] text-fg-4">
                One-time setup: register an OAuth App at{' '}
                <a
                  href="https://github.com/settings/applications/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-fg-3 no-underline hover:text-secondary hover:underline"
                >
                  github.com/settings/applications/new
                </a>{' '}
                — any homepage URL, check <strong>Enable Device Flow</strong>, copy the Client ID.
              </p>
            </>
          ) : (
            <>
              <Row label="Access token" hint="Fine-grained PAT.">
                <input
                  type="password"
                  value={token}
                  placeholder="github_pat_… or ghp_…"
                  onChange={(e) => setToken(e.target.value)}
                  aria-label="GitHub personal access token"
                  className={`${inputMono} w-full max-w-[300px]`}
                />
              </Row>
              <Row label="Repo name">
                <input
                  type="text"
                  value={patRepo}
                  onChange={(e) => setPatRepo(e.target.value)}
                  aria-label="Repository name"
                  className={`${inputCls} w-full max-w-[300px]`}
                />
              </Row>
              <div className="mt-2 flex items-center gap-3">
                <Button variant="raised" disabled={busy} onClick={connectPat}>
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
              <p className="m-0 mt-1 max-w-[58ch] text-[11.5px] leading-[1.55] tracking-[-0.003em] text-fg-4">
                Required scope: <code className="text-fg-3">Contents: Read and write</code> ·{' '}
                <code className="text-fg-3">Administration: Read and write</code> (to create the
                repo).
              </p>
            </>
          )}
        </>
      )}
    </Section>
  )
}

// ---------- LeetCode history ----------

function HistorySection() {
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
    <Section
      id="history"
      title="LeetCode history"
      sub="Pull your accepted submissions. New entries are added as Mastered with no SRS impact."
    >
      <div className="flex items-center gap-3">
        <Button
          variant="raised"
          disabled={busy || typeof login !== 'object'}
          onClick={runImport}
        >
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
    </Section>
  )
}

// ---------- Account ----------

function AccountSection({
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
    <Section
      id="account"
      title="Account"
      sub="Sign in with Google to sync your progress. Your data stays private to your account."
    >
      {auth?.signedIn ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-[13px] text-fg-2">
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
          <Button
            variant="raised"
            className="w-full"
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
          >
            {busy ? <Spinner /> : <GoogleIcon size={14} />}
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </Button>
        </div>
      )}
    </Section>
  )
}
