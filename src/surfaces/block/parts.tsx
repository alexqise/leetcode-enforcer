// Shared block-page building blocks. The layout variants in
// BlockMain.variant-*.tsx compose these — data hooks, the override
// modal (placement-independent), and the suggestion/review atoms.

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { DueRow } from '../../components/DueRow'
import { diffTextClass } from '../../components/difficulty'
import { ArrowRightIcon, ArrowUpRightIcon, WarningIcon } from '../../components/icons'
import { Skeleton } from '../../components/Skeleton'
import type { CatalogItem, DailyChallenge, DueProblem } from '../../engine/types'
import { isMsgError, type StatusResponse, send } from '../../messages'

export interface BlockMainProps {
  status: StatusResponse | null
}

// ---------- data ----------

export function useFromUrl(): string | null {
  return useMemo(() => {
    const from = new URLSearchParams(location.search).get('from')
    if (!from) return null
    try {
      return new URL(decodeURIComponent(from)).host.replace(/^www\./, '')
    } catch {
      return null
    }
  }, [])
}

export interface Suggestions {
  loaded: boolean
  daily: DailyChallenge | null
  random: CatalogItem | null
}

export function useSuggestions(): Suggestions {
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

  return sug
}

// ---------- override (placement-independent) ----------

export function useOverride(status: StatusResponse | null): {
  modal: ReactNode
  open: () => void
  hint: string
  disabled: boolean
} {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const settings = status?.settings
  const state = status?.state
  const overridesLeft = (settings?.overrideCountPerDay || 0) - (state?.overrideUsedToday || 0)
  const disabled = !settings || !settings.overrideEnabled || overridesLeft <= 0
  const phrase = settings?.overridePhrase || 'the quick brown fox jumps over the lazy dog'

  const hint = !settings
    ? ''
    : !settings.overrideEnabled
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

  const modal = (
    <Dialog
      open={isOpen}
      onClose={() => setIsOpen(false)}
      title="Use an override?"
      mark={<WarningIcon size={14} />}
      error={err}
      actions={
        <>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy} onClick={confirm}>
            Override
          </Button>
        </>
      }
    >
      <p className="m-0 mb-3.5 text-[12.5px] leading-[1.55] tracking-[-0.003em] text-fg-2">
        Type the phrase below to unblock for {settings?.overrideDurationMin || 10} minutes.
        Overrides are limited and logged.
      </p>
      <div className="mb-3">
        <code className="inline-block rounded-md bg-bg px-3 py-2 text-[12.5px] text-fg">
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
        className="mb-4 w-full rounded-none border-0 border-b border-border bg-surface/50 px-2 py-2 text-[13px] text-fg transition-colors duration-100 placeholder:text-fg-2 focus:border-fg-3 focus:outline-none"
      />
    </Dialog>
  )

  return {
    modal,
    open: () => {
      setErr('')
      setValue('')
      setIsOpen(true)
    },
    hint,
    disabled,
  }
}

// ---------- suggestion atoms ----------

const titleSizes = {
  lg: 'text-[21px] max-sm:text-[19px]',
  xl: 'text-[24px] max-sm:text-[20px]',
} as const

export function DailyLink({
  sug,
  size = 'lg',
  label = 'Daily challenge',
  centered = false,
}: {
  sug: Suggestions
  size?: keyof typeof titleSizes
  label?: string
  centered?: boolean
}) {
  const { loaded, daily } = sug
  return (
    <a
      href={daily?.url ?? 'https://leetcode.com/problemset/'}
      target="_top"
      className={`group flex min-w-0 flex-col text-fg no-underline ${
        centered ? 'items-center text-center' : 'items-start'
      }`}
    >
      <span className="mb-2 text-[11.5px] font-medium tracking-[-0.003em] text-fg-3">{label}</span>
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`${titleSizes[size]} font-semibold leading-[1.3] tracking-[-0.02em] text-fg [overflow-wrap:anywhere] transition-colors duration-100 group-hover:text-primary`}
        >
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
      <span className="mt-1.5 text-[12.5px] tracking-[-0.003em] text-fg-3">
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
  )
}

export function RandomLine({ sug }: { sug: Suggestions }) {
  const { loaded, random } = sug
  return (
    <p className="m-0 text-[12.5px] tracking-[-0.003em] text-fg-3">
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
  )
}

// ---------- reviews ----------

export function DueRows({
  due,
  cap = 3,
  emptyText = 'No reviews due today.',
}: {
  due?: DueProblem[]
  cap?: number
  emptyText?: string
}) {
  const top = (due ?? []).slice(0, cap)
  if (top.length === 0) {
    return <div className="py-2 text-[12.5px] tracking-[-0.003em] text-fg-3">{emptyText}</div>
  }
  return (
    <div className="flex flex-col">
      {top.map((p) => (
        <DueRow key={p.slug} problem={p} />
      ))}
    </div>
  )
}

// ---------- copy ----------

export function quotaNumbers(status: StatusResponse | null) {
  const quota = status ? Math.max(1, status.settings.dailyQuota) : 1
  const solved = status?.state.solvesToday ?? 0
  const remaining = status ? Math.max(0, status.settings.dailyQuota - solved) : null
  return { quota, solved, remaining }
}

export function coachHeadline(remaining: number | null, fromHost: string | null): ReactNode {
  if (remaining === null) return <>&nbsp;</>
  if (remaining === 0) return <>You're clear for today.</>
  return (
    <>
      Solve <span className="text-primary">{remaining}</span> more to get back to{' '}
      {fromHost ?? 'your sites'}.
    </>
  )
}

export function resetNote(status: StatusResponse | null): string {
  if (!status) return ''
  return `resets ${String(status.settings.quotaResetHour ?? 3).padStart(2, '0')}:00`
}
