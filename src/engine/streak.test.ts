import { describe, expect, it } from 'vitest'
import {
  computeDailyResetPatch,
  computeNextResetISO,
  computeStreakAdvance,
  yesterdayISO,
} from './streak'

const TODAY = '2026-06-09'
const YESTERDAY = '2026-06-08'

describe('computeStreakAdvance', () => {
  const base = {
    solvesToday: 1,
    dailyQuota: 1,
    streakDays: 5,
    streakLastUpdated: YESTERDAY as string | null,
    today: TODAY,
    yesterday: YESTERDAY,
  }

  it('does nothing below quota', () => {
    expect(computeStreakAdvance({ ...base, solvesToday: 0 })).toBeNull()
    expect(computeStreakAdvance({ ...base, solvesToday: 2, dailyQuota: 3 })).toBeNull()
  })

  it('does nothing when already advanced today', () => {
    expect(computeStreakAdvance({ ...base, streakLastUpdated: TODAY })).toBeNull()
  })

  it('continues the streak when last advance was yesterday', () => {
    expect(computeStreakAdvance(base)).toEqual({ streakDays: 6, streakLastUpdated: TODAY })
  })

  it('restarts at 1 after a gap', () => {
    expect(computeStreakAdvance({ ...base, streakLastUpdated: '2026-06-01' })).toEqual({
      streakDays: 1,
      streakLastUpdated: TODAY,
    })
  })

  it('starts at 1 for a fresh install (no prior advance)', () => {
    expect(computeStreakAdvance({ ...base, streakLastUpdated: null })).toEqual({
      streakDays: 1,
      streakLastUpdated: TODAY,
    })
  })
})

describe('computeDailyResetPatch', () => {
  const next = '2026-06-10T03:00:00.000Z'

  it('zeroes the day counters and clears any override', () => {
    const patch = computeDailyResetPatch({
      streakDays: 5,
      streakLastUpdated: YESTERDAY,
      yesterday: YESTERDAY,
      nextResetAt: next,
    })
    expect(patch.solvesToday).toBe(0)
    expect(patch.reviewsToday).toBe(0)
    expect(patch.newSolvesToday).toBe(0)
    expect(patch.overrideUsedToday).toBe(0)
    expect(patch.overrideActiveUntil).toBeNull()
    expect(patch.quotaResetAt).toBe(next)
  })

  it('keeps the streak when yesterday quota was hit', () => {
    const patch = computeDailyResetPatch({
      streakDays: 5,
      streakLastUpdated: YESTERDAY,
      yesterday: YESTERDAY,
      nextResetAt: next,
    })
    expect(patch.streakDays).toBe(5)
  })

  it('breaks the streak when yesterday quota was missed', () => {
    const patch = computeDailyResetPatch({
      streakDays: 5,
      streakLastUpdated: '2026-06-05',
      yesterday: YESTERDAY,
      nextResetAt: next,
    })
    expect(patch.streakDays).toBe(0)
  })
})

describe('computeNextResetISO', () => {
  it('targets 03:00 today when invoked before the hour', () => {
    const now = new Date(2026, 5, 9, 2, 0, 0) // 02:00 local, June 9
    const next = new Date(computeNextResetISO(3, now))
    expect(next.getHours()).toBe(3)
    expect(next.getDate()).toBe(9)
  })

  it('rolls to tomorrow when invoked after the hour', () => {
    const now = new Date(2026, 5, 9, 4, 0, 0)
    const next = new Date(computeNextResetISO(3, now))
    expect(next.getHours()).toBe(3)
    expect(next.getDate()).toBe(10)
  })

  it('rolls to tomorrow when invoked exactly at the hour', () => {
    const now = new Date(2026, 5, 9, 3, 0, 0)
    const next = new Date(computeNextResetISO(3, now))
    expect(next.getDate()).toBe(10)
  })

  it('respects a custom reset hour', () => {
    const now = new Date(2026, 5, 9, 4, 0, 0)
    const next = new Date(computeNextResetISO(6, now))
    expect(next.getHours()).toBe(6)
    expect(next.getDate()).toBe(9)
  })
})

describe('yesterdayISO', () => {
  it('returns the prior calendar day', () => {
    expect(yesterdayISO(new Date('2026-06-09T12:00:00Z'))).toBe('2026-06-08')
  })

  it('crosses month boundaries', () => {
    expect(yesterdayISO(new Date('2026-06-01T12:00:00Z'))).toBe('2026-05-31')
  })
})
