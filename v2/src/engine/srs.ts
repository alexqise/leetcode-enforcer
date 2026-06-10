// Port of v1 lib/srs.js — spaced-repetition ladder math. Pure logic,
// covered by srs.test.ts. `today` is injectable for deterministic tests;
// callers in production omit it.

import type { DueProblem, Problem, ProblemMap } from './types'

export const DEFAULT_LADDER = [1, 3, 7, 14, 30]

export function advanceInterval(currentDays: number, ladder: number[] = DEFAULT_LADDER): number {
  const idx = ladder.indexOf(currentDays)
  if (idx === -1) return ladder[0] ?? 1
  if (idx === ladder.length - 1) return ladder[idx] ?? 1
  return ladder[idx + 1] ?? 1
}

export function stayAtInterval(currentDays: number, ladder: number[] = DEFAULT_LADDER): number {
  return ladder.includes(currentDays) ? currentDays : (ladder[0] ?? 1)
}

export function computeNextInterval(args: {
  currentDays: number
  needReview: boolean
  ladder?: number[]
}): number {
  const { currentDays, needReview, ladder = DEFAULT_LADDER } = args
  return needReview ? stayAtInterval(currentDays, ladder) : advanceInterval(currentDays, ladder)
}

export function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function nextDueDate(lastReviewedISO: string, intervalDays: number): string {
  return addDays(lastReviewedISO, intervalDays)
}

export function isDue(problem: Problem | undefined, todayISO: string): boolean {
  if (problem?.status !== 'Active') return false
  if (!problem.lastReviewed) return true
  const due = nextDueDate(problem.lastReviewed, problem.srsIntervalDays)
  return todayISO >= due
}

export function getDueProblems(
  problems: ProblemMap,
  todayISO: string,
  limit = Number.POSITIVE_INFINITY,
): DueProblem[] {
  return Object.entries(problems)
    .filter(([, p]) => isDue(p, todayISO))
    .map(([slug, p]) => ({ slug, ...p }))
    .sort((a, b) => {
      const da = nextDueDate(a.lastReviewed ?? a.firstSolved ?? '', a.srsIntervalDays)
      const db = nextDueDate(b.lastReviewed ?? b.firstSolved ?? '', b.srsIntervalDays)
      return da.localeCompare(db)
    })
    .slice(0, limit)
}

export function newProblemDefaults(
  meta: Pick<Problem, 'number' | 'title' | 'url' | 'difficulty' | 'topics'>,
  today: string = new Date().toISOString().slice(0, 10),
): Problem {
  return {
    number: meta.number,
    title: meta.title,
    url: meta.url,
    difficulty: meta.difficulty,
    topics: meta.topics,
    firstSolved: today,
    lastReviewed: today,
    timesReviewed: 1,
    srsIntervalDays: DEFAULT_LADDER[0] ?? 1,
    status: 'Active',
    latestConfidence: null,
    notes: '',
    history: [],
  }
}

export interface ReviewInput {
  confidence: number | null
  notes: string
  needReview: boolean
  mastered: boolean
  ladder?: number[]
  /** Injectable for tests; defaults to the current date. */
  today?: string
}

export function mergeReview(problem: Problem, review: ReviewInput): Problem {
  const {
    confidence,
    notes,
    needReview,
    mastered,
    ladder = DEFAULT_LADDER,
    today = new Date().toISOString().slice(0, 10),
  } = review

  const isReview = !!problem.lastReviewed && problem.lastReviewed !== today
  const nextInterval = mastered
    ? problem.srsIntervalDays
    : computeNextInterval({ currentDays: problem.srsIntervalDays, needReview, ladder })

  const accumulatedNotes = notes
    ? problem.notes
      ? `${problem.notes}, ${notes}`
      : notes
    : problem.notes

  return {
    ...problem,
    lastReviewed: today,
    timesReviewed: problem.timesReviewed + (isReview ? 1 : 0),
    srsIntervalDays: nextInterval,
    status: mastered ? 'Mastered' : problem.status,
    latestConfidence: confidence ?? problem.latestConfidence,
    notes: accumulatedNotes,
    history: [
      ...(problem.history || []),
      {
        date: today,
        type: isReview ? 'review' : 'solve',
        confidence,
        needReview: !!needReview,
        mastered: !!mastered,
      },
    ],
  }
}
