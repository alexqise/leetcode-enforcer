// Port of v1 lib/stats.js — dashboard stats from problem history.

import type { Problem, ProblemMap, State } from './types'

interface DatedHistoryEntry {
  date: string
  confidence: number | null
  difficulty: string
}

export interface Stats {
  kpis: {
    streak: number
    thisWeek: number
    totalActive: number
    totalMastered: number
  }
  perDay: [string, number][]
  difficulty: [string, number][]
  confidence: [string, number][]
}

export function computeStats(problems: ProblemMap, state: Pick<State, 'streakDays'>): Stats {
  const all = Object.values(problems)
  const active = all.filter((p) => p.status === 'Active')
  const mastered = all.filter((p) => p.status === 'Mastered')

  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const allHistory: DatedHistoryEntry[] = all.flatMap((p) =>
    (p.history || []).map((h) => ({
      date: h.date,
      confidence: h.confidence,
      difficulty: p.difficulty,
    })),
  )
  const thisWeek = allHistory.filter((h) => new Date(h.date) >= weekAgo).length

  const kpis = {
    streak: state.streakDays || 0,
    thisWeek,
    totalActive: active.length,
    totalMastered: mastered.length,
  }

  const perDay = computePerDay(allHistory, 90)
  const difficulty = computeDifficultyMix(all)
  const confidence = computeConfidenceTrend(allHistory)

  return { kpis, perDay, difficulty, confidence }
}

function computePerDay(history: DatedHistoryEntry[], days: number): [string, number][] {
  const buckets: Record<string, number> = {}
  const today = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    buckets[key] = 0
  }
  for (const h of history) {
    const current = buckets[h.date]
    if (current !== undefined) buckets[h.date] = current + 1
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => [date, count])
}

function computeDifficultyMix(problems: Problem[]): [string, number][] {
  const counts: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 }
  for (const p of problems) {
    if (counts[p.difficulty] !== undefined) {
      counts[p.difficulty] = (counts[p.difficulty] ?? 0) + 1
    }
  }
  return Object.entries(counts).map(([k, v]) => [k, v])
}

function computeConfidenceTrend(history: DatedHistoryEntry[]): [string, number][] {
  const byWeek: Record<string, { sum: number; n: number }> = {}
  for (const h of history) {
    if (typeof h.confidence !== 'number') continue
    const week = isoWeek(h.date)
    let bucket = byWeek[week]
    if (!bucket) {
      bucket = { sum: 0, n: 0 }
      byWeek[week] = bucket
    }
    bucket.sum += h.confidence
    bucket.n += 1
  }
  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { sum, n }]) => [week, +(sum / n).toFixed(2)])
}

function isoWeek(dateISO: string): string {
  const d = new Date(dateISO)
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + (4 - (d.getDay() || 7)))
  const yearStart = new Date(thursday.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${thursday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
