// Open document table — sortable, filterable problem tracker. No outer
// borders or row hairlines (design.md §7); scroll lives in the table region.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { diffTextClass } from '../../components/difficulty'
import { SearchIcon } from '../../components/icons'
import {
  cmpRows,
  DIFFICULTY_ORDER,
  type Sort,
  type SortKey,
  STATUS_ORDER,
  todayISO,
  type ViewRow,
} from './rows'

interface Filters {
  status: Set<string>
  difficulty: Set<string>
  topics: Set<string>
}

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: 'number', label: '№', className: 'w-14' },
  { key: 'title', label: 'Title' },
  { key: 'difficulty', label: 'Difficulty', className: 'w-24' },
  { key: null, label: 'Topics' },
  { key: 'status', label: 'Status', className: 'w-28' },
  { key: 'latestConfidence', label: 'Confidence', className: 'w-28' },
  { key: null, label: 'Notes' },
  { key: 'firstSolved', label: 'First solved', className: 'w-28' },
  { key: 'lastReviewed', label: 'Last reviewed', className: 'w-28' },
  { key: 'nextDue', label: 'Next due', className: 'w-28' },
  { key: 'srsIntervalDays', label: 'Interval', className: 'w-20' },
]

const CONF_SEG = ['bg-hard', 'bg-medium/70', 'bg-medium', 'bg-easy', 'bg-primary'] as const

export function TableView({ rows, focusSearch }: { rows: ViewRow[]; focusSearch: number }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>({ key: 'lastReviewed', dir: 'desc' })
  const [filters, setFilters] = useState<Filters>({
    status: new Set(),
    difficulty: new Set(),
    topics: new Set(),
  })
  const [density, setDensity] = useState<'compact' | 'default'>('default')
  const [showFilters, setShowFilters] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusSearch > 0) {
      searchRef.current?.focus()
      searchRef.current?.select()
    }
  }, [focusSearch])

  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of rows) for (const t of r.topics) counts[t] = (counts[t] || 0) + 1
    return counts
  }, [rows])

  const filtered = useMemo(() => {
    let out = rows
    const q = search.trim().toLowerCase()
    if (q) {
      out = out.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          String(p.number || '').includes(q),
      )
    }
    out = out.filter((p) => {
      if (filters.status.size > 0 && !filters.status.has(p.status)) return false
      if (
        filters.difficulty.size > 0 &&
        p.difficulty !== 'Unknown' &&
        !filters.difficulty.has(p.difficulty)
      )
        return false
      if (filters.topics.size > 0 && !p.topics.some((t) => filters.topics.has(t))) return false
      return true
    })
    const m = sort.dir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => cmpRows(a, b, sort.key) * m)
  }, [rows, search, filters, sort])

  const filterCount = filters.status.size + filters.difficulty.size + filters.topics.size

  function toggleFilter(field: keyof Filters, value: string) {
    setFilters((f) => {
      const next = new Set(f[field])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...f, [field]: next }
    })
  }

  function clickSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  }

  const today = todayISO()

  return (
    <div>
      <div className="mx-auto w-full max-w-[1100px] px-10 max-sm:px-5">
        <div className="flex flex-wrap items-center gap-4 pt-10 pb-6">
          <span className="text-[12px] tracking-[-0.003em] text-fg-3">
            <span className="font-medium text-fg-2">{filtered.length}</span>
            {filtered.length === rows.length ? ' problems' : ` of ${rows.length}`}
          </span>
          <div className="relative min-w-[200px] max-w-[520px] flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-fg-3" />
            <input
              ref={searchRef}
              value={search}
              placeholder="Search title, number, slug"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearch('')
                  e.currentTarget.blur()
                }
              }}
              className="w-full cursor-text border-0 border-b border-border bg-transparent py-2 pr-14 pl-7 text-[13px] tracking-[-0.005em] text-fg transition-colors duration-100 placeholder:text-fg-2 focus:border-border-2 focus:outline-none"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-3">
              ⌘K
            </kbd>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant={showFilters ? 'outline' : 'ghost'}
              onClick={() => setShowFilters((v) => !v)}
              className="text-[12px]"
            >
              Filter
              {filterCount > 0 && (
                <span className="rounded-full bg-surface-3 px-1.5 text-[10px] text-fg-2">
                  {filterCount}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDensity((d) => (d === 'compact' ? 'default' : 'compact'))}
              className="text-[12px]"
            >
              {density === 'compact' ? 'Default spacing' : 'Compact'}
            </Button>
          </div>
        </div>

        {showFilters && (
          <FilterPanel
            rows={rows}
            filters={filters}
            topicCounts={topicCounts}
            onToggle={toggleFilter}
          />
        )}
      </div>

      <div className="mx-auto w-full max-w-[1100px] overflow-x-auto px-10 pb-6 max-sm:px-5">
        <table className="w-full border-collapse text-[13px] tracking-[-0.005em]">
          <thead className="sticky top-0 z-10 bg-bg">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  className={`pb-3 text-left text-[12px] font-medium tracking-[-0.005em] whitespace-nowrap first:pl-0 last:pr-0 ${
                    c.key
                      ? 'cursor-pointer select-none pr-[38px] text-fg-3 hover:text-fg-2'
                      : 'pr-6 text-fg-3'
                  } ${c.className ?? 'pr-6'}`}
                  onClick={c.key ? () => clickSort(c.key as SortKey) : undefined}
                  aria-sort={
                    sort.key === c.key
                      ? sort.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className="relative inline-block">
                    {c.label}
                    {c.key && (
                      <span
                        className={`absolute top-1/2 left-full ml-2 w-3 -translate-y-1/2 text-center text-[10px] text-primary ${
                          sort.key === c.key ? 'opacity-100' : 'opacity-0'
                        }`}
                        aria-hidden="true"
                      >
                        {sort.key === c.key ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="py-16 pl-0">
                  <p className="m-0 text-[13px] text-fg-3">
                    {rows.length === 0
                      ? "Solve a problem on leetcode.com and it'll appear here."
                      : 'No matches — clear filters or try a different search.'}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((r) => <Row key={r.slug} row={r} today={today} density={density} />)
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}

function FilterPanel({
  rows,
  filters,
  topicCounts,
  onToggle,
}: {
  rows: ViewRow[]
  filters: Filters
  topicCounts: Record<string, number>
  onToggle: (field: keyof Filters, value: string) => void
}) {
  const topics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const countBy = (field: 'status' | 'difficulty', val: string) =>
    rows.filter((p) => p[field] === val).length

  return (
    <div className="mb-8 flex flex-col gap-8">
      <FilterSection label="Status">
        {STATUS_ORDER.map((s) => (
          <Chip
            key={s}
            label={s}
            count={countBy('status', s)}
            set={filters.status}
            onClick={() => onToggle('status', s)}
          />
        ))}
      </FilterSection>
      <FilterSection label="Difficulty">
        {DIFFICULTY_ORDER.map((d) => (
          <Chip
            key={d}
            label={d}
            count={countBy('difficulty', d)}
            set={filters.difficulty}
            onClick={() => onToggle('difficulty', d)}
          />
        ))}
      </FilterSection>
      <FilterSection label={`Topics · ${topics.length}`}>
        {topics.map(([t, c]) => (
          <Chip
            key={t}
            label={t}
            count={c}
            set={filters.topics}
            onClick={() => onToggle('topics', t)}
          />
        ))}
      </FilterSection>
    </div>
  )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="m-0 mb-2.5 text-[11px] font-semibold tracking-[-0.005em] text-fg-3">
        {label}
      </h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  label,
  count,
  set,
  onClick,
}: {
  label: string
  count: number
  set: Set<string>
  onClick: () => void
}) {
  const on = set.has(label)
  const inactive = set.size > 0 && !on
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium tracking-[-0.003em] transition-colors duration-100 ${
        on
          ? 'border-border-2 bg-surface-3 text-fg shadow-[inset_0_0_0_1px_var(--color-border-2)]'
          : inactive
            ? 'border-border bg-transparent text-fg-4 opacity-55 hover:opacity-80'
            : 'border-border bg-surface text-fg-2 hover:border-border-2 hover:text-fg'
      }`}
    >
      {label}
      <span className={`text-[10px] ${on ? 'text-fg-3' : 'text-fg-4'}`}>{count}</span>
    </button>
  )
}

function Row({ row: r, today, density }: { row: ViewRow; today: string; density: string }) {
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const py = density === 'compact' ? 'py-3' : 'py-[18px]'
  const muted = <span className="text-fg-4">—</span>

  const dueCls =
    r.nextDue && r.nextDue < today
      ? 'text-hard'
      : r.nextDue === today
        ? 'text-secondary'
        : 'text-fg-3'

  const shownTopics = topicsOpen ? r.topics : r.topics.slice(0, 3)
  const extraTopics = r.topics.length - 3
  const conf = r.latestConfidence ?? 0

  return (
    <tr className="transition-colors duration-75 hover:bg-surface">
      <td className={`${py} pr-6 align-top text-[12px] text-fg-3`}>{r.number ?? '·'}</td>
      <td className={`${py} max-w-[320px] pr-6 align-top`}>
        <a
          href={r.url}
          target="_blank"
          rel="noreferrer"
          title={r.title}
          className="group inline-flex max-w-full min-w-0 items-center gap-1.5 font-medium tracking-[-0.008em] text-fg no-underline hover:text-primary"
        >
          <span className="truncate">{r.title}</span>
          <span className="shrink-0 text-fg-4 opacity-0 transition-opacity duration-100 group-hover:text-primary group-hover:opacity-100">
            ↗
          </span>
        </a>
      </td>
      <td className={`${py} pr-6 align-top`}>
        {r.difficulty !== 'Unknown' ? (
          <span className={`font-medium ${diffTextClass(r.difficulty)}`}>{r.difficulty}</span>
        ) : (
          muted
        )}
      </td>
      <td className={`${py} max-w-[280px] pr-6 align-top`}>
        {r.topics.length === 0 ? (
          muted
        ) : (
          <span className="flex flex-wrap gap-1">
            {shownTopics.map((t) => (
              <span key={t} className="text-[11px] tracking-[-0.003em] text-fg-3">
                {t}
              </span>
            ))}
            {extraTopics > 0 && (
              <button
                type="button"
                onClick={() => setTopicsOpen((v) => !v)}
                className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-fg-3 transition-colors duration-100 hover:text-fg"
              >
                {topicsOpen ? 'collapse' : `+${extraTopics}`}
              </button>
            )}
          </span>
        )}
      </td>
      <td className={`${py} pr-6 align-top`}>
        <span
          className={`flex items-center gap-1.5 text-[12px] font-medium ${
            r.status === 'Mastered'
              ? 'text-secondary'
              : r.status === 'Active'
                ? 'text-fg-2'
                : 'text-fg-3'
          }`}
        >
          <span aria-hidden="true" className="text-[9px]">
            {r.status === 'Mastered' ? '★' : r.status === 'Active' ? '●' : '◌'}
          </span>
          {r.status}
        </span>
      </td>
      <td className={`${py} pr-6 align-top`}>
        {r.latestConfidence == null ? (
          muted
        ) : (
          <span
            role="img"
            aria-label={`Confidence ${r.latestConfidence} of 5`}
            className="flex items-center gap-[3px]"
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`h-1 w-3 rounded-full ${
                  i <= conf ? CONF_SEG[i - 1] : 'bg-surface-3'
                }`}
              />
            ))}
          </span>
        )}
      </td>
      <td className={`${py} max-w-[280px] pr-6 align-top`}>
        {!r.notes ? (
          muted
        ) : (
          <button
            type="button"
            title={notesOpen ? 'Click to collapse' : 'Click to expand'}
            onClick={() => setNotesOpen((v) => !v)}
            className={`block w-full cursor-pointer border-0 bg-transparent p-0 text-left text-[12px] tracking-[-0.003em] text-fg-3 transition-colors duration-100 hover:text-fg-2 ${
              notesOpen ? 'whitespace-pre-wrap break-words' : 'truncate'
            }`}
          >
            {r.notes}
          </button>
        )}
      </td>
      <td className={`${py} pr-6 align-top whitespace-nowrap text-[12px] text-fg-3`}>
        {r.firstSolved ?? muted}
      </td>
      <td className={`${py} pr-6 align-top whitespace-nowrap text-[12px] text-fg-3`}>
        {r.lastReviewed ?? muted}
      </td>
      <td className={`${py} pr-6 align-top whitespace-nowrap text-[12px] ${dueCls}`}>
        {r.nextDue ?? muted}
      </td>
      <td className={`${py} align-top text-[12px] text-fg-3`}>
        {r.srsIntervalDays ? `${r.srsIntervalDays}d` : muted}
      </td>
    </tr>
  )
}
