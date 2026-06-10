// Onboarding — rework of v1's three-step flow (SPEC §4): same
// connect → quota → blocklist order, rebuilt with visible step progress,
// per-step skip paths, real error states, and the sunrise banner variant.

import { useEffect, useState } from 'react'
import { BannerScene } from '../../components/BannerScene'
import { Button } from '../../components/Button'
import {
  AlertCircleIcon,
  ArrowRightIcon,
  BrandIcon,
  CheckSquareIcon,
  GoogleIcon,
} from '../../components/icons'
import { Spinner } from '../../components/Spinner'
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../../engine/storage'
import { isMsgError, send } from '../../messages'

type Step = 1 | 2 | 3 | 'done'

const STEPS: { n: 1 | 2 | 3; label: string }[] = [
  { n: 1, label: 'Sign in' },
  { n: 2, label: 'Quota' },
  { n: 3, label: 'Blocklist' },
]

function errorText(raw: string | undefined): string {
  if (!navigator.onLine) return 'You appear to be offline — reconnect, then try again.'
  return raw || 'Something went wrong. Try again.'
}

export function App() {
  const [step, setStep] = useState<Step>(1)
  const [quota, setQuota] = useState(1)
  const [blocklist, setBlocklist] = useState<string[]>([...DEFAULT_SETTINGS.blocklist])
  const [enabled, setEnabled] = useState<Set<string>>(new Set(DEFAULT_SETTINGS.blocklist))

  useEffect(() => {
    getSettings().then((s) => {
      setQuota(s.dailyQuota)
      const list = s.blocklist.length ? s.blocklist : [...DEFAULT_SETTINGS.blocklist]
      setBlocklist(list)
      setEnabled(new Set(list))
    })
  }, [])

  async function finish() {
    const picked = blocklist.filter((d) => enabled.has(d))
    await send({ type: 'updateSettings', patch: { blocklist: picked, dailyQuota: quota } })
    const { state } = await chrome.storage.local.get('state')
    await chrome.storage.local.set({ state: { ...(state || {}), installComplete: true } })
    setStep('done')
  }

  return (
    <>
      <BannerScene variant="sunrise">
        <header className="absolute inset-x-0 top-0 flex items-center justify-between px-10 py-5 max-sm:px-5 max-sm:py-4">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.015em] text-[#F4F1F6]">
            <BrandIcon className="shrink-0 text-[rgba(244,241,246,0.7)]" />
            <span>Enforcer</span>
          </div>
          <span className="text-xs tracking-[-0.003em] text-[rgba(244,241,246,0.65)]">Setup</span>
        </header>
      </BannerScene>

      <main className="mx-auto max-w-[560px] px-6 pb-16">
        {step !== 'done' && <StepProgress current={step} />}

        {step === 1 && <StepConnect onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepQuota
            quota={quota}
            setQuota={setQuota}
            onBack={() => setStep(1)}
            onNext={async () => {
              await setSettings({ dailyQuota: quota })
              setStep(3)
            }}
          />
        )}
        {step === 3 && (
          <StepBlocklist
            blocklist={blocklist}
            setBlocklist={setBlocklist}
            enabled={enabled}
            setEnabled={setEnabled}
            onBack={() => setStep(2)}
            onFinish={finish}
          />
        )}
        {step === 'done' && <StepDone />}
      </main>
    </>
  )
}

// ---------- step progress ----------

function StepProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Setup progress" className="mt-10 mb-10 flex items-center gap-2">
      {STEPS.map((s, i) => {
        const state = s.n < current ? 'done' : s.n === current ? 'current' : 'todo'
        return (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-border-2" aria-hidden="true" />}
            <div
              aria-current={state === 'current' ? 'step' : undefined}
              className={`flex items-center gap-2 text-xs font-medium tracking-[-0.003em] ${
                state === 'current' ? 'text-fg' : state === 'done' ? 'text-fg-2' : 'text-fg-4'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10.5px] ${
                  state === 'done'
                    ? 'border-primary bg-primary-dim text-primary'
                    : state === 'current'
                      ? 'border-fg-3 text-fg'
                      : 'border-border-2 text-fg-4'
                }`}
              >
                {state === 'done' ? (
                  <svg viewBox="0 0 16 16" width="9" height="9" aria-hidden="true">
                    <path
                      d="M3 8.5l3.5 3.5L13 4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  s.n
                )}
              </span>
              {s.label}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function StepHeading({ title, sub, hint }: { title: string; sub: string; hint?: string }) {
  return (
    <header className="mb-7">
      <h1 className="m-0 mb-2 text-[26px] font-semibold tracking-[-0.025em] text-fg">{title}</h1>
      <p className="m-0 max-w-[46ch] text-[13.5px] leading-[1.6] tracking-[-0.003em] text-fg-2">
        {sub}
      </p>
      {hint && (
        <p className="m-0 mt-2 max-w-[50ch] text-xs leading-[1.55] tracking-[-0.003em] text-fg-3">
          {hint}
        </p>
      )}
    </header>
  )
}

// ---------- step 1: connect ----------

function StepConnect({ onNext }: { onNext: () => void }) {
  const [auth, setAuth] = useState<'checking' | 'signedOut' | { email: string }>('checking')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    send({ type: 'getAuthState' }).then((res) => {
      if (!isMsgError(res) && res.signedIn) setAuth({ email: res.email || 'you' })
      else setAuth('signedOut')
    })
  }, [])

  async function signIn() {
    if (busy) return
    if (!navigator.onLine) {
      setErr('You appear to be offline — reconnect, then try again.')
      return
    }
    setBusy(true)
    setErr('')
    const res = await send({ type: 'signInGoogle' })
    setBusy(false)
    if (isMsgError(res) || !res.ok) {
      setErr(errorText(isMsgError(res) ? res.error : res.error))
      return
    }
    setAuth({ email: res.email || 'you' })
    setTimeout(onNext, 600)
  }

  const signedIn = typeof auth === 'object'

  return (
    <section aria-label="Sign in">
      <StepHeading
        title="Sign in with Google"
        sub="Your progress syncs privately to your account — problems, streak, and settings follow you across devices."
        hint="You'll be redirected to Google for one click, then back here. Nothing else to set up."
      />

      {signedIn ? (
        <div className="mb-7 flex items-center gap-2 text-[12.5px] text-fg-2">
          <CheckSquareIcon className="text-easy" />
          Signed in as <strong className="font-semibold text-fg">{auth.email}</strong>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || auth === 'checking'}
          onClick={signIn}
          className="mb-4 flex cursor-pointer items-center gap-2.5 rounded-md border border-border-2 bg-surface-2 px-5 py-2.5 text-[13px] font-semibold tracking-[-0.003em] text-fg transition-colors duration-100 hover:enabled:border-fg-3 hover:enabled:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Spinner /> : <GoogleIcon />}
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>
      )}

      {err && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 text-[12px] leading-[1.5] text-hard"
        >
          <AlertCircleIcon className="mt-0.5 shrink-0" />
          {err}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between border-t border-border pt-4">
        <span className="text-[11.5px] text-fg-3">
          {signedIn ? '' : 'You can sign in later from the popup.'}
        </span>
        {signedIn ? (
          <Button variant="primary" onClick={onNext}>
            Continue
          </Button>
        ) : (
          <Button variant="ghost" onClick={onNext}>
            Skip for now
          </Button>
        )}
      </div>
    </section>
  )
}

// ---------- step 2: quota ----------

function StepQuota({
  quota,
  setQuota,
  onBack,
  onNext,
}: {
  quota: number
  setQuota: (n: number) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <section aria-label="Daily quota">
      <StepHeading
        title="Set your daily quota"
        sub="How many problems do you need to solve per day before distracting sites unblock?"
        hint="Reviews count toward this. Default is 1 — you can change it anytime in settings."
      />

      <div className="mb-2 flex items-center gap-5">
        <input
          type="range"
          min={1}
          max={5}
          value={quota}
          onChange={(e) => setQuota(Number(e.target.value))}
          aria-label="Problems per day"
          className="w-64 accent-primary"
        />
        <div className="font-mono text-[15px] text-fg">
          <span className="text-[28px] font-medium">{quota}</span>
          <span className="text-fg-3"> / day</span>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-border pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext}>
          Next
        </Button>
      </div>
    </section>
  )
}

// ---------- step 3: blocklist ----------

function StepBlocklist({
  blocklist,
  setBlocklist,
  enabled,
  setEnabled,
  onBack,
  onFinish,
}: {
  blocklist: string[]
  setBlocklist: (l: string[]) => void
  enabled: Set<string>
  setEnabled: (s: Set<string>) => void
  onBack: () => void
  onFinish: () => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  function toggle(d: string, on: boolean) {
    const next = new Set(enabled)
    if (on) next.add(d)
    else next.delete(d)
    setEnabled(next)
  }

  function add() {
    const v = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
    if (!v || blocklist.includes(v)) return
    setBlocklist([...blocklist, v])
    toggle(v, true)
    setValue('')
  }

  return (
    <section aria-label="Blocklist">
      <StepHeading
        title="Confirm your blocklist"
        sub="These sites redirect to the block page until you hit your quota. Uncheck any you want to leave open."
      />

      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 max-sm:grid-cols-1">
        {blocklist.map((d) => (
          <label
            key={d}
            className="group -mx-2 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] text-fg-2 transition-colors duration-100 hover:bg-surface"
          >
            <input
              type="checkbox"
              checked={enabled.has(d)}
              onChange={(e) => toggle(d, e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            <span className={`flex-1 truncate ${enabled.has(d) ? 'text-fg' : 'text-fg-3'}`}>
              {d}
            </span>
            <button
              type="button"
              title={`Remove ${d}`}
              aria-label={`Remove ${d}`}
              onClick={(e) => {
                e.preventDefault()
                setBlocklist(blocklist.filter((x) => x !== d))
              }}
              className="cursor-pointer rounded border-0 bg-transparent px-1 text-fg-4 opacity-0 transition-opacity duration-100 hover:text-fg group-hover:opacity-100"
            >
              ×
            </button>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          placeholder="Add another (e.g. news.ycombinator.com)"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg transition-colors duration-100 placeholder:text-fg-3 focus:border-border-2 focus:bg-surface-2 focus:outline-none"
        />
        <Button variant="outline" onClick={add}>
          Add
        </Button>
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-border pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onFinish()
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Finishing…' : 'Finish setup'}
        </Button>
      </div>
    </section>
  )
}

// ---------- done ----------

function StepDone() {
  const [ghToken, setGhToken] = useState('')
  const [ghRepo, setGhRepo] = useState('leetcode-enforcer-solutions')
  const [ghBusy, setGhBusy] = useState(false)
  const [ghStatus, setGhStatus] = useState<
    null | { ok: true; owner: string; repo: string; url: string } | { ok: false; error: string }
  >(null)

  async function connectGithub() {
    const token = ghToken.trim()
    if (!token) {
      setGhStatus({ ok: false, error: 'Paste a token first.' })
      return
    }
    setGhBusy(true)
    setGhStatus(null)
    const res = await send({
      type: 'connectGithub',
      token,
      repoName: ghRepo.trim() || 'leetcode-enforcer-solutions',
    })
    setGhBusy(false)
    if (isMsgError(res) || !res.ok) {
      setGhStatus({ ok: false, error: errorText(isMsgError(res) ? res.error : res.error) })
    } else {
      setGhToken('')
      setGhStatus({ ok: true, owner: res.owner, repo: res.repo, url: res.url })
    }
  }

  return (
    <section aria-label="Setup complete" className="mt-12">
      <header className="mb-8">
        <h1 className="m-0 mb-2 text-[26px] font-semibold tracking-[-0.025em] text-fg">
          You're ready
        </h1>
        <p className="m-0 text-[13.5px] leading-[1.6] tracking-[-0.003em] text-fg-2">
          The extension is enforcing your quota now. Go solve.
        </p>
      </header>

      <a
        href="https://leetcode.com/problemset/"
        target="_blank"
        rel="noreferrer"
        className="group inline-flex items-center gap-3 text-[19px] font-semibold tracking-[-0.02em] text-fg no-underline transition-colors duration-100 hover:text-primary"
      >
        Open LeetCode
        <ArrowRightIcon className="text-fg-4 transition-[color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:text-primary motion-safe:group-hover:translate-x-[3px]" />
      </a>

      <p className="m-0 mt-6 max-w-[52ch] text-xs leading-[1.55] tracking-[-0.003em] text-fg-3">
        Already have solved problems? Import your LeetCode history anytime from{' '}
        <a
          href={chrome.runtime.getURL('src/surfaces/options/index.html#history')}
          className="text-secondary no-underline hover:underline"
        >
          Settings
        </a>
        .
      </p>

      <div className="mt-12 border-t border-border pt-6">
        <h2 className="m-0 mb-1.5 text-xs font-semibold tracking-[-0.003em] text-fg-2">
          Optional · sync code to GitHub
        </h2>
        <p className="m-0 mb-4 max-w-[52ch] text-xs leading-[1.55] tracking-[-0.003em] text-fg-3">
          Push every accepted submission to a private repo as a single commit. Create a fine-grained
          PAT with <code className="font-mono text-fg-2">Contents</code> and{' '}
          <code className="font-mono text-fg-2">Administration</code> write access, then paste it
          below.{' '}
          <a
            href="https://github.com/settings/tokens?type=beta"
            target="_blank"
            rel="noreferrer"
            className="text-secondary no-underline hover:underline"
          >
            Create a fine-grained PAT
          </a>
        </p>
        <div className="flex max-w-[420px] flex-col gap-2">
          <input
            type="password"
            value={ghToken}
            placeholder="github_pat_… or ghp_…"
            onChange={(e) => setGhToken(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-[12.5px] tracking-normal text-fg transition-colors duration-100 placeholder:text-fg-3 focus:border-border-2 focus:bg-surface-2 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={ghRepo}
              placeholder="repo name"
              onChange={(e) => setGhRepo(e.target.value)}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg transition-colors duration-100 placeholder:text-fg-3 focus:border-border-2 focus:bg-surface-2 focus:outline-none"
            />
            <Button variant="outline" disabled={ghBusy} onClick={connectGithub}>
              {ghBusy ? 'Connecting…' : 'Connect'}
            </Button>
          </div>
          {ghStatus && (
            <div aria-live="polite" className="text-xs leading-[1.5]">
              {ghStatus.ok ? (
                <span className="text-fg-2">
                  Connected ·{' '}
                  <a
                    href={ghStatus.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-secondary no-underline hover:underline"
                  >
                    {ghStatus.owner}/{ghStatus.repo}
                  </a>
                </span>
              ) : (
                <span className="text-hard">{ghStatus.error}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
