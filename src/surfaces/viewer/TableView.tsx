// Table view — the full problem table, keeping v1's iterated interaction
// patterns (SPEC §4): reserved-space sort indicators, 3-state filter
// chips, expanding notes/topics, ⌘K search, density toggle, status bar.

import { useEffect, useMemo, useRef, useState } from 'react'
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
  { key: 'latestConfidence', label: 'Confidence', className: 'w-24' },
  { key: null, label: 'Notes' },
  { key: 'firstSolved', label: 'First solved', className: 'w-28' },
  { key: 'lastReviewed', label: 'Last reviewed', className: 'w-28' },
  { key: 'nextDue', label: 'Next due', className: 'w-28' },
  { key: 'srsIntervalDays', label: 'Interval', className: 'w-20' },
]

export function TableView({ rows, focusSearch }: { rows: ViewRow[]; focusSearch: number }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>({ key: 'lastReviewed', dir: 'desc' })
  const [filters, setFilters] = useState<Filters>({
    status: new Set(),
    difficulty: new Set(),
    topics: new Set(),
  })
  const [density, setDensity] = useState<'compact' | 'default'>('compact')
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
  const due = filtered.filter(
    (p) => p.nextDue && p.nextDue <= today && p.status === 'Active',
  ).length
  const over = filtered.filter(
    (p) => p.nextDue && p.nextDue < today && p.status === 'Active',
  ).length
  const act = filtered.filter((p) => p.status === 'Active').length
  const mast = filtered.filter((p) => p.status === 'Mastered').length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* table controls */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-2.5">
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10.5px] text-fg-2">
          {filtered.length} / {rows.length}
        </span>
        <div className="relative max-w-[340px] flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-3" />
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
            className="w-full rounded-md border border-border bg-surface py-1.5 pr-12 pl-8 text-[12.5px] text-fg transition-colors duration-100 placeholder:text-fg-3 focus:border-border-2 focus:bg-surface-2 focus:outline-none"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-fg-3">
            ⌘K
          </kbd>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-100 ${
              showFilters
                ? 'border-border-2 bg-surface-2 text-fg'
                : 'border-border bg-transparent text-fg-2 hover:bg-surface-2 hover:text-fg'
            }`}
          >
            Filter
            {filterCount > 0 && (
              <span className="rounded-full bg-primary-dim px-1.5 text-[10px] text-primary">
                {filterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setDensity((d) => (d === 'compact' ? 'default' : 'compact'))}
            className="cursor-pointer rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-fg-2 transition-colors duration-100 hover:bg-surface-2 hover:text-fg"
          >
            {density === 'compact' ? 'Compact' : 'Default'}
          </button>
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

      {/* table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-bg">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  className={`border-b border-border px-3 py-2 text-left text-[11px] font-semibold tracking-[-0.003em] whitespace-nowrap ${
                    c.key ? 'cursor-pointer select-none text-fg-3 hover:text-fg' : 'text-fg-3'
                  } ${c.className ?? ''}`}
                  onClick={c.key ? () => clickSort(c.key as SortKey) : undefined}
                  aria-sort={
                    sort.key === c.key
                      ? sort.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {c.label}
                  {/* reserved-space sort indicator — no layout shift on sort */}
                  {c.key && (
                    <span className="inline-block w-3 text-center text-[10px] text-primary">
                      {sort.key === c.key ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length}>
                  <div className="px-6 py-16 text-center">
                    <h2 className="m-0 mb-1 text-[15px] font-semibold text-fg">
                      {rows.length === 0 ? 'No problems tracked' : 'No matches'}
                    </h2>
                    <p className="m-0 text-[12.5px] text-fg-3">
                      {rows.length === 0
                        ? "Solve a problem on leetcode.com and it'll appear here."
                        : 'Clear filters or try a different search.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((r) => <Row key={r.slug} row={r} today={today} density={density} />)
            )}
          </tbody>
        </table>
      </div>

      {/* status bar */}
      <footer className="flex items-center justify-between border-t border-border px-6 py-2 text-[10.5px] text-fg-3">
        <div className="flex items-center gap-4">
          <span>
            <strong className="font-medium text-secondary">{due}</strong> due
          </span>
          <span>
            <strong className="font-medium text-hard">{over}</strong> overdue
          </span>
          <span>
            <strong className="font-medium text-fg-2">{act}</strong> active
          </span>
          <span>
            <strong className="font-medium text-fg-2">{mast}</strong> mastered
          </span>
        </div>
        <span>
          sorted by {sort.key} · {sort.dir}
        </span>
      </footer>
    </div>
  )
}

// ---------- filter panel (3-state chips) ----------

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
    <aside className="flex flex-col gap-4 border-b border-border bg-surface px-6 py-4">
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
    </aside>
  )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="m-0 mb-2 text-[10.5px] font-semibold tracking-[0.02em] text-fg-3">{label}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

/** 3-state chip: on / neutral / inactive (dimmed when the set has other selections). */
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
      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-100 ${
        on
          ? 'border-primary bg-primary-dim text-primary'
          : inactive
            ? 'border-border bg-transparent text-fg-4 hover:text-fg-2'
            : 'border-border bg-surface-2 text-fg-2 hover:border-border-2 hover:text-fg'
      }`}
    >
      {label}
      <span className={` text-[10px] ${on ? 'text-primary' : 'text-fg-4'}`}>{count}</span>
    </button>
  )
}

// ---------- row ----------

function Row({ row: r, today, density }: { row: ViewRow; today: string; density: string }) {
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const pad = density === 'compact' ? 'py-1.5' : 'py-3'
  const cell = `border-b border-border px-3 align-top ${pad}`
  const muted = <span className="text-fg-4">—</span>

  const dueCls =
    r.nextDue && r.nextDue < today
      ? 'text-hard'
      : r.nextDue === today
        ? 'text-secondary'
        : 'text-fg-3'

  const shownTopics = topicsOpen ? r.topics : r.topics.slice(0, 3)
  const extraTopics = r.topics.length - 3

  return (
    <tr className="transition-colors duration-75 hover:bg-surface">
      <td className={`${cell}  text-[11.5px] text-fg-3`}>{r.number ?? '·'}</td>
      <td className={`${cell} max-w-[320px]`}>
        <a
          href={r.url}
          target="_blank"
          rel="noreferrer"
          title={r.title}
          className="group block truncate font-medium text-fg no-underline hover:text-primary"
        >
          {r.title}
          <span className="ml-1 text-fg-4 group-hover:text-primary">↗</span>
        </a>
      </td>
      <td className={cell}>
        {' '}
        {r.difficulty !== 'Unknown' ? (
          <span className={`font-medium ${diffTextClass(r.difficulty)}`}>{r.difficulty}</span>
        ) : (
          muted
        )}
      </td>
      <td className={`${cell} max-w-[260px]`}>
        {r.topics.length === 0 ? (
          muted
        ) : (
          <span className="flex flex-wrap gap-1">
            {shownTopics.map((t) => (
              <span
                key={t}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-fg-2"
              >
                {t}
              </span>
            ))}
            {extraTopics > 0 && (
              <button
                type="button"
                onClick={() => setTopicsOpen((v) => !v)}
                className="cursor-pointer rounded-full border-0 bg-surface-3 px-2 py-0.5 text-[10.5px] text-fg-3 transition-colors duration-100 hover:text-fg"
              >
                {topicsOpen ? 'collapse' : `+${extraTopics}`}
              </button>
            )}
          </span>
        )}
      </td>
      <td className={cell}>
        {' '}
        <span
          className={`flex items-center gap-1.5 text-[11.5px] font-medium ${
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
      <td className={cell}>
        {' '}
        {r.latestConfidence == null ? (
          muted
        ) : (
          <span
            role="img"
            aria-label={`Confidence ${r.latestConfidence} of 5`}
            className="flex items-center gap-0.5"
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`h-1 w-2.5 rounded-full ${
                  i <= (r.latestConfidence ?? 0) ? 'bg-primary' : 'bg-surface-3'
                }`}
              />
            ))}
          </span>
        )}
      </td>
      <td className={`${cell} max-w-[240px]`}>
        {!r.notes ? (
          muted
        ) : (
          <button
            type="button"
            title={notesOpen ? 'Click to collapse' : 'Click to expand'}
            onClick={() => setNotesOpen((v) => !v)}
            className={`block w-full cursor-pointer border-0 bg-transparent p-0 text-left text-[11.5px] text-fg-2 ${
              notesOpen ? '' : 'truncate'
            }`}
          >
            {r.notes}
          </button>
        )}
      </td>
      <td className={`${cell} whitespace-nowrap  text-[11px] text-fg-3`}>
        {r.firstSolved ?? muted}
      </td>
      <td className={`${cell} whitespace-nowrap  text-[11px] text-fg-3`}>
        {r.lastReviewed ?? muted}
      </td>
      <td className={`${cell} whitespace-nowrap  text-[11px] ${dueCls}`}>{r.nextDue ?? muted}</td>
      <td className={`${cell}  text-[11px] text-fg-3`}>
        {r.srsIntervalDays ? `${r.srsIntervalDays}d` : muted}
      </td>
    </tr>
  )
}
