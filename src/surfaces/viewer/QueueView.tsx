// Queue view — the viewer's landing screen (SPEC §4 rethink): what's due
// now, streak, and headline stats, in open content. The full table is one
// tab away.

import { diffDotClass, diffTextClass } from '../../components/difficulty'
import { ArrowRightIcon, FlameIcon } from '../../components/icons'
import { SegmentedBar } from '../../components/SegmentedBar'
import type { Settings, State } from '../../engine/types'
import { todayISO, type ViewRow } from './rows'

interface QueueViewProps {
  rows: ViewRow[]
  state: State
  settings: Settings
  onOpenTable: () => void
}

export function QueueView({ rows, state, settings, onOpenTable }: QueueViewProps) {
  const today = todayISO()
  const active = rows.filter((r) => r.status === 'Active')
  const due = active
    .filter((r) => !r.nextDue || r.nextDue <= today)
    .sort((a, b) => (a.nextDue ?? '').localeCompare(b.nextDue ?? ''))
  const overdue = due.filter((r) => r.nextDue && r.nextDue < today)
  const mastered = rows.filter((r) => r.status === 'Mastered')
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const thisWeek = rows.filter((r) => r.lastReviewed && r.lastReviewed >= weekAgo).length

  const quota = Math.max(1, settings.dailyQuota)
  const solved = state.solvesToday

  return (
    <div className="mx-auto max-w-[760px] px-8 pt-10 pb-16">
      {/* Today */}
      <section aria-label="Today" className="mb-12">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h1 className="m-0 flex items-baseline gap-3">
            <span className="text-[40px] font-medium leading-none tracking-[-0.02em] text-fg">
              {due.length}
            </span>
            <span className="text-[15px] tracking-[-0.01em] text-fg-2">
              {due.length === 1 ? 'review due now' : 'reviews due now'}
            </span>
          </h1>
          <span className="flex items-center gap-1.5 text-xs text-fg-2">
            <FlameIcon className="text-medium" />
            <span className="font-medium text-fg">{state.streakDays || 0}</span>-day streak
          </span>
        </div>
        <SegmentedBar total={quota} filled={solved} label="Daily quota" className="mb-2" />
        <div className="text-[11.5px] text-fg-3">
          {solved} of {settings.dailyQuota} solved today
        </div>
      </section>

      {/* KPIs */}
      <section aria-label="Stats" className="mb-12 flex gap-12 max-sm:flex-wrap max-sm:gap-6">
        <Kpi label="overdue" value={overdue.length} accent={overdue.length > 0} />
        <Kpi label="this week" value={thisWeek} />
        <Kpi label="active" value={active.length} />
        <Kpi label="mastered" value={mastered.length} />
      </section>

      {/* Due list */}
      <section aria-label="Due problems">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-0 text-xs font-semibold tracking-[-0.003em] text-fg-2">Due now</h2>
          <button
            type="button"
            onClick={onOpenTable}
            className="group flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium text-fg-3 transition-colors duration-100 hover:text-fg"
          >
            All problems
            <ArrowRightIcon
              size={12}
              className="transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:translate-x-0.5"
            />
          </button>
        </div>

        {due.length === 0 ? (
          <p className="m-0 py-4 text-[13px] text-fg-3">
            Nothing due.{' '}
            {active.length === 0 && rows.length === 0
              ? 'Solve a problem on leetcode.com and it will appear here.'
              : 'Come back tomorrow, or browse the table.'}
          </p>
        ) : (
          <div className="flex flex-col">
            {due.map((r) => (
              <DueQueueRow key={r.slug} row={r} today={today} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div
        className={` text-[24px] font-medium leading-none tracking-[-0.01em] ${
          accent ? 'text-hard' : 'text-fg'
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] tracking-[-0.003em] text-fg-3">{label}</div>
    </div>
  )
}

function DueQueueRow({ row: r, today }: { row: ViewRow; today: string }) {
  const overdueDays =
    r.nextDue && r.nextDue < today
      ? Math.round((new Date(today).getTime() - new Date(r.nextDue).getTime()) / 86400000)
      : 0
  return (
    <div className="-mx-3 flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-100 hover:bg-surface">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${diffDotClass(r.difficulty)}`} />
      <a
        href={r.url}
        target="_blank"
        rel="noreferrer"
        title={r.title}
        className="min-w-0 flex-1 truncate text-[13.5px] font-medium tracking-[-0.005em] text-fg no-underline hover:text-primary"
      >
        {r.number ? `${r.number}. ` : ''}
        {r.title}
      </a>
      {overdueDays > 0 && (
        <span className="shrink-0 rounded-full bg-[rgba(239,111,108,0.1)] px-2 py-0.5 text-[10.5px] text-hard">
          {overdueDays}d over
        </span>
      )}
      <span className="shrink-0 text-[11px] text-fg-3">
        <span className={diffTextClass(r.difficulty)}>{r.difficulty}</span>{' '}
        {` · ${r.srsIntervalDays}d`}
      </span>
    </div>
  )
}
