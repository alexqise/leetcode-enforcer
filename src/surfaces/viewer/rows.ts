// Data shaping for the viewer: raw stored problems → flat sortable rows.
// Ported from v1 viewer1/viewer.js (load/cmp/computeNextDue).

import type { ProblemMap } from '../../engine/types'

export const STATUS_ORDER = ['Active', 'Mastered', 'Archived']
export const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard']

export interface ViewRow {
  slug: string
  number: number | null
  title: string
  url: string
  difficulty: string
  topics: string[]
  firstSolved: string | null
  lastReviewed: string | null
  timesReviewed: number
  srsIntervalDays: number
  nextDue: string | null
  status: string
  latestConfidence: number | null
  notes: string
}

export type SortKey =
  | 'number'
  | 'title'
  | 'difficulty'
  | 'status'
  | 'latestConfidence'
  | 'firstSolved'
  | 'lastReviewed'
  | 'nextDue'
  | 'srsIntervalDays'

export interface Sort {
  key: SortKey
  dir: 'asc' | 'desc'
}

export function computeNextDue(last: string | null, days: number): string | null {
  if (!last || !days) return null
  const d = new Date(last)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function toRows(problems: ProblemMap): ViewRow[] {
  return Object.entries(problems).map(([slug, p]) => ({
    slug,
    number: Number.isFinite(p.number) ? p.number : null,
    title: p.title || slug,
    url: p.url || `https://leetcode.com/problems/${slug}/`,
    difficulty: p.difficulty || 'Unknown',
    topics: Array.isArray(p.topics) ? p.topics : [],
    firstSolved: p.firstSolved || null,
    lastReviewed: p.lastReviewed || null,
    timesReviewed: p.timesReviewed || 0,
    srsIntervalDays: p.srsIntervalDays || 0,
    nextDue: computeNextDue(p.lastReviewed, p.srsIntervalDays || 0),
    status: p.status || 'Active',
    latestConfidence: typeof p.latestConfidence === 'number' ? p.latestConfidence : null,
    notes: p.notes || '',
  }))
}

export function cmpRows(a: ViewRow, b: ViewRow, key: SortKey): number {
  const av = a[key]
  const bv = b[key]
  if ((av == null || av === '') && (bv == null || bv === '')) return 0
  if (av == null || av === '') return 1
  if (bv == null || bv === '') return -1
  if (key === 'difficulty') {
    return DIFFICULTY_ORDER.indexOf(av as string) - DIFFICULTY_ORDER.indexOf(bv as string)
  }
  if (key === 'status') {
    return STATUS_ORDER.indexOf(av as string) - STATUS_ORDER.indexOf(bv as string)
  }
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv))
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
