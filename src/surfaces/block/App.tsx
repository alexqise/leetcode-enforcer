// Block page — the dusk-signal reference surface (SPEC §4). Port of the
// v1 design: banner scene, open hero, two-column grid, title-as-link
// daily challenge, open review rows, override footer + phrase modal.

import { useEffect, useMemo, useState } from 'react'
import { BannerScene } from '../../components/BannerScene'
import { Dialog } from '../../components/Dialog'
import { DueRow } from '../../components/DueRow'
import { diffTextClass } from '../../components/difficulty'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  ClockIcon,
  StarIcon,
  WarningIcon,
} from '../../components/icons'
import { SectionLabel } from '../../components/SectionLabel'
import { SegmentedBar } from '../../components/SegmentedBar'
import { Skeleton } from '../../components/Skeleton'
import { StreakChip } from '../../components/StreakChip'
import type { CatalogItem, DailyChallenge, DueProblem, Settings, State } from '../../engine/types'
import { useStatus } from '../../hooks/useStatus'
import { isMsgError, send } from '../../messages'

const btnBase =
  'cursor-pointer rounded-md border px-4 py-2 text-[12.5px] font-medium tracking-[-0.003em] transition-colors duration-100'

export function App() {
  const { status, error } = useStatus()

  if (error) {
    return (
      <div className="mx-auto mt-[30vh] max-w-[640px] px-8 text-[13px] leading-relaxed text-fg-2">
        LeetCode Enforcer is unavailable. Reload the page; if that fails, reload the extension from
        chrome://extensions.
      </div>
    )
  }

  return (
    <>
      <BannerScene>
        <header className="absolute inset-x-0 top-0 flex items-center justify-between px-10 py-5 max-sm:px-5 max-sm:py-4">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.015em] text-[#F4F1F6]">
            <span>Enforcer</span>
            <span
              title="Blocking is active"
              className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_3px_rgba(255,111,60,0.18)]"
            />
          </div>
          <StreakChip days={status?.state.streakDays ?? 0} />
        </header>
      </BannerScene>

      <main className="mx-auto max-w-[980px] px-10 pb-16 max-sm:px-5 max-sm:pb-12">
        <Hero settings={status?.settings} state={status?.state} />

        <div className="mt-16 grid grid-cols-[minmax(0,1fr)_300px] gap-x-[72px] max-sm:mt-12 max-[880px]:grid-cols-[minmax(0,1fr)] max-[880px]:gap-y-14">
          <Suggest />
          <Reviews due={status?.due} />
        </div>

        {status && <Emergency settings={status.settings} state={status.state} />}
      </main>
    </>
  )
}

// ---------- Hero ----------

function Hero({ settings, state }: { settings?: Settings; state?: State }) {
  const from = useFromUrl()
  const loaded = !!(settings && state)
  const quota = loaded ? Math.max(1, settings.dailyQuota) : 1
  const solved = loaded ? state.solvesToday : 0
  const remaining = loaded ? Math.max(0, settings.dailyQuota - solved) : null

  const label =
    remaining === null
      ? 'loading'
      : remaining === 0
        ? 'quota met'
        : remaining === 1
          ? 'problem left today'
          : 'problems left today'

  return (
    <section aria-label="Today's progress" className="mt-12 max-sm:mt-9">
      <div className="mb-[26px] flex flex-wrap items-baseline justify-between gap-6 max-sm:mb-[22px]">
        <h1 className="m-0 flex flex-wrap items-baseline gap-4">
          <span
            className={`text-[76px] font-semibold leading-none tracking-[-0.032em] max-sm:text-[54px] ${
              remaining === 0 ? 'text-primary' : 'text-fg'
            }`}
          >
            {remaining ?? '–'}
          </span>
          <span className="text-[19px] tracking-[-0.015em] text-fg-2 max-sm:text-base">
            {label}
          </span>
        </h1>
        {from && (
          <p className="m-0 text-xs tracking-[-0.003em] text-fg-3">
            Blocked from <code className="text-[11.5px] font-medium text-fg-2">{from}</code>
          </p>
        )}
      </div>

      <SegmentedBar total={quota} filled={solved} label="Daily quota" className="mb-2.5" />

      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[11.5px] text-fg-3">
          {loaded ? `${solved} of ${settings.dailyQuota} solved` : ''}
        </span>
        <span className="text-[11.5px] text-fg-3">
          {loaded ? `resets ${String(settings.quotaResetHour ?? 3).padStart(2, '0')}:00` : ''}
        </span>
      </div>
    </section>
  )
}

function useFromUrl(): string | null {
  return useMemo(() => {
    const from = new URLSearchParams(location.search).get('from')
    if (!from) return null
    try {
      return new URL(decodeURIComponent(from)).host
    } catch {
      return null
    }
  }, [])
}

// ---------- Suggestions (main column) ----------

interface Suggestions {
  loaded: boolean
  daily: DailyChallenge | null
  random: CatalogItem | null
}

function Suggest() {
  const [sug, setSug] = useState<Suggestions>({ loaded: false, daily: null, random: null })

  useEffect(() => {
    let alive = true
    Promise.all([send({ type: 'fetchDailyChallenge' }), send({ type: 'getRandomUnsolved' })]).then(
      ([daily, random]) => {
        if (!alive) return
        setSug({
          loaded: true,
          daily: isMsgError(daily) ? null : daily,
          random: isMsgError(random) ? null : random,
        })
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const { loaded, daily, random } = sug

  return (
    <section aria-label="Suggested problems">
      <SectionLabel icon={<StarIcon />}>Solve your way out</SectionLabel>

      <a
        href={daily?.url ?? 'https://leetcode.com/problemset/'}
        target="_top"
        className="group flex min-w-0 flex-col items-start text-fg no-underline"
      >
        <span className="mb-2.5 text-[11.5px] font-medium tracking-[-0.003em] text-fg-3">
          Daily challenge
        </span>
        <span className="flex min-w-0 items-center gap-3">
          <span className="text-[21px] font-semibold leading-[1.3] tracking-[-0.02em] text-fg [overflow-wrap:anywhere] transition-colors duration-100 group-hover:text-primary max-sm:text-[19px]">
            {!loaded ? (
              <Skeleton className="h-4 w-60" />
            ) : daily ? (
              `${daily.number}. ${daily.title}`
            ) : (
              "Can't reach LeetCode"
            )}
          </span>
          <ArrowRightIcon className="shrink-0 text-fg-4 transition-[color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:text-primary motion-safe:group-hover:translate-x-[3px]" />
        </span>
        <span className="mt-[7px] text-[12.5px] tracking-[-0.003em] text-fg-3">
          {!loaded ? (
            <Skeleton className="h-[11px] w-[150px]" />
          ) : daily ? (
            <>
              <span className={`font-medium ${diffTextClass(daily.difficulty)}`}>
                {daily.difficulty}
              </span>
              {daily.topics.length > 0 && ` · ${daily.topics.slice(0, 3).join(', ')}`}
            </>
          ) : (
            'Sign in to leetcode.com, then reload this page.'
          )}
        </span>
      </a>

      <p className="mt-5 mb-0 text-[12.5px] tracking-[-0.003em] text-fg-3">
        <span>{loaded && !random ? 'or ' : 'or try a random one: '}</span>
        <a
          href={random?.url ?? 'https://leetcode.com/problemset/'}
          target="_top"
          className="font-medium text-fg-2 no-underline transition-colors duration-100 hover:text-secondary [&_svg]:align-[-1.5px] [&_svg]:text-fg-3 hover:[&_svg]:text-secondary"
        >
          {!loaded ? (
            <Skeleton className="h-[11px] w-[180px]" />
          ) : random ? (
            <>
              {`${random.number}. ${random.title}`}
              <span className="whitespace-nowrap font-normal text-fg-3">
                {` · ${random.difficulty} `}
                <ArrowUpRightIcon />
              </span>
            </>
          ) : (
            <>
              browse the problem{' '}
              <span className="whitespace-nowrap">
                set <ArrowUpRightIcon />
              </span>
            </>
          )}
        </a>
      </p>
    </section>
  )
}

// ---------- Reviews (side column) ----------

function Reviews({ due }: { due?: DueProblem[] }) {
  const top = (due ?? []).slice(0, 3)
  return (
    <aside aria-label="Reviews due">
      <SectionLabel icon={<ClockIcon />} className="mb-1">
        Reviews due
      </SectionLabel>
      <p className="m-0 mb-2.5 text-[11.5px] tracking-[-0.003em] text-fg-3">
        These count toward your quota.
      </p>
      <div className="flex flex-col">
        {top.length === 0 ? (
          <div className="py-2.5 text-[12.5px] tracking-[-0.003em] text-fg-3">
            No reviews due today.
          </div>
        ) : (
          top.map((p) => <DueRow key={p.slug} problem={p} />)
        )}
      </div>
    </aside>
  )
}

// ---------- Emergency override (footer) ----------

function Emergency({ settings, state }: { settings: Settings; state: State }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const overridesLeft = (settings.overrideCountPerDay || 0) - (state.overrideUsedToday || 0)
  const disabled = !settings.overrideEnabled || overridesLeft <= 0
  const phrase = settings.overridePhrase || 'the quick brown fox jumps over the lazy dog'

  const hint = !settings.overrideEnabled
    ? 'Override disabled in settings.'
    : overridesLeft <= 0
      ? 'No uses left today.'
      : `${overridesLeft} use${overridesLeft === 1 ? '' : 's'} left today · ${settings.overrideDurationMin} minutes`

  async function confirm() {
    if (busy) return
    if (value !== phrase) {
      setErr('Phrase must match exactly.')
      return
    }
    setBusy(true)
    const res = await send({ type: 'startOverride', phrase: value })
    setBusy(false)
    if (isMsgError(res)) {
      setErr(res.error)
      return
    }
    if (!res.ok) {
      setErr(res.error || 'Override failed.')
      return
    }
    const from = new URLSearchParams(location.search).get('from')
    location.replace(from ? decodeURIComponent(from) : 'https://www.google.com')
  }

  return (
    <footer className="mt-16 flex items-center justify-between gap-4 border-t border-border pt-5 max-sm:mt-12 max-sm:flex-col max-sm:items-start max-sm:gap-3">
      <div>
        <SectionLabel icon={<WarningIcon />} className="mb-0">
          Emergency override
        </SectionLabel>
        <div className="mt-1 text-[11.5px] tracking-[-0.003em] text-fg-3">{hint}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setErr('')
          setValue('')
          setOpen(true)
        }}
        className={`${btnBase} whitespace-nowrap border-border-2 bg-transparent text-fg-2 hover:enabled:border-fg-3 hover:enabled:bg-surface-2 hover:enabled:text-fg disabled:cursor-not-allowed disabled:opacity-35 max-sm:self-stretch`}
      >
        Override…
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Use an override?"
        mark={<WarningIcon size={14} />}
        error={err}
        actions={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`${btnBase} border-transparent bg-transparent text-fg-2 hover:border-border hover:bg-surface-2 hover:text-fg`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={confirm}
              className={`${btnBase} border-hard bg-hard font-semibold text-bg hover:enabled:border-[#FF8B88] hover:enabled:bg-[#FF8B88] disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Override
            </button>
          </>
        }
      >
        <p className="m-0 mb-3.5 text-[12.5px] leading-[1.55] tracking-[-0.003em] text-fg-2">
          Type the phrase below to unblock for {settings.overrideDurationMin || 10} minutes.
          Overrides are limited and logged.
        </p>
        <div className="mb-3">
          <code className="inline-block rounded-md border border-border bg-bg px-3 py-2 text-[12.5px]  text-fg">
            {phrase}
          </code>
        </div>
        <input
          type="text"
          data-autofocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm()
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder="Type the exact phrase"
          aria-label="Override phrase"
          className="mb-4 w-full rounded-md border border-border bg-bg px-3 py-[9px] text-[13px]  text-fg transition-colors duration-100 placeholder:text-fg-2 focus:border-border-2 focus:bg-surface-2 focus:outline-none"
        />
      </Dialog>
    </footer>
  )
}
