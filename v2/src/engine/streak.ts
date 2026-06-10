// Streak + daily-reset logic, extracted from v1's service worker
// (maybeAdvanceStreak / doDailyReset / computeNextResetISO) so the
// edge cases are unit-testable. The service worker is a thin caller.

import type { State } from './types'

export function yesterdayISO(now: Date = new Date()): string {
  return new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
}

/**
 * Streak advance on quota completion. Returns the state patch to apply,
 * or null when nothing changes (quota not yet met, or already advanced
 * today). Mirrors v1 maybeAdvanceStreak exactly: continuing a streak
 * requires the last advance to have been yesterday; otherwise reset to 1.
 */
export function computeStreakAdvance(args: {
  solvesToday: number
  dailyQuota: number
  streakDays: number
  streakLastUpdated: string | null
  today: string
  yesterday: string
}): Pick<State, 'streakDays' | 'streakLastUpdated'> | null {
  if (args.solvesToday < args.dailyQuota) return null
  if (args.streakLastUpdated === args.today) return null
  const streakDays = args.streakLastUpdated === args.yesterday ? args.streakDays + 1 : 1
  return { streakDays, streakLastUpdated: args.today }
}

/**
 * The daily reset (03:00 alarm by default): zero the day counters and
 * keep the streak only if yesterday's quota was hit (streakLastUpdated
 * === yesterday). Mirrors v1 doDailyReset.
 */
export function computeDailyResetPatch(args: {
  streakDays: number
  streakLastUpdated: string | null
  yesterday: string
  nextResetAt: string
}): Partial<State> {
  const hitYesterdayQuota = args.streakLastUpdated === args.yesterday
  return {
    solvesToday: 0,
    reviewsToday: 0,
    newSolvesToday: 0,
    overrideUsedToday: 0,
    overrideActiveUntil: null,
    streakDays: hitYesterdayQuota ? args.streakDays : 0,
    quotaResetAt: args.nextResetAt,
  }
}

/** Next occurrence of `hour:00` local time, as ISO. Mirrors v1. */
export function computeNextResetISO(hour = 3, now: Date = new Date()): string {
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next.toISOString()
}
