import { describe, expect, it } from 'vitest'
import {
  addDays,
  advanceInterval,
  computeNextInterval,
  DEFAULT_LADDER,
  getDueProblems,
  isDue,
  mergeReview,
  newProblemDefaults,
  stayAtInterval,
} from './srs'
import type { Problem } from './types'

function problem(overrides: Partial<Problem> = {}): Problem {
  return {
    number: 1,
    title: 'Two Sum',
    url: 'https://leetcode.com/problems/two-sum/',
    difficulty: 'Easy',
    topics: ['Array'],
    firstSolved: '2026-06-01',
    lastReviewed: '2026-06-01',
    timesReviewed: 1,
    srsIntervalDays: 1,
    status: 'Active',
    latestConfidence: null,
    notes: '',
    history: [],
    ...overrides,
  }
}

describe('advanceInterval', () => {
  it('climbs the ladder', () => {
    expect(advanceInterval(1)).toBe(3)
    expect(advanceInterval(3)).toBe(7)
    expect(advanceInterval(7)).toBe(14)
    expect(advanceInterval(14)).toBe(30)
  })

  it('caps at the top rung', () => {
    expect(advanceInterval(30)).toBe(30)
  })

  it('resets to the first rung when off-ladder', () => {
    expect(advanceInterval(5)).toBe(1)
    expect(advanceInterval(0)).toBe(1)
  })

  it('respects a custom ladder', () => {
    expect(advanceInterval(2, [2, 5, 9])).toBe(5)
    expect(advanceInterval(9, [2, 5, 9])).toBe(9)
  })
})

describe('stayAtInterval', () => {
  it('keeps a valid rung', () => {
    expect(stayAtInterval(7)).toBe(7)
  })

  it('snaps off-ladder values to the first rung', () => {
    expect(stayAtInterval(11)).toBe(1)
  })
})

describe('computeNextInterval', () => {
  it('advances when the review went well', () => {
    expect(computeNextInterval({ currentDays: 3, needReview: false })).toBe(7)
  })

  it('stays when the user flags need-review', () => {
    expect(computeNextInterval({ currentDays: 3, needReview: true })).toBe(3)
  })
})

describe('addDays', () => {
  it('adds across month boundaries', () => {
    expect(addDays('2026-06-29', 3)).toBe('2026-07-02')
  })
})

describe('isDue', () => {
  it('never marks mastered problems due', () => {
    expect(isDue(problem({ status: 'Mastered' }), '2099-01-01')).toBe(false)
  })

  it('marks never-reviewed active problems due', () => {
    expect(isDue(problem({ lastReviewed: null }), '2026-06-09')).toBe(true)
  })

  it('is due exactly on lastReviewed + interval', () => {
    const p = problem({ lastReviewed: '2026-06-01', srsIntervalDays: 7 })
    expect(isDue(p, '2026-06-07')).toBe(false)
    expect(isDue(p, '2026-06-08')).toBe(true)
    expect(isDue(p, '2026-06-09')).toBe(true)
  })

  it('handles undefined problems', () => {
    expect(isDue(undefined, '2026-06-09')).toBe(false)
  })
})

describe('getDueProblems', () => {
  it('filters, sorts by due date ascending, and limits', () => {
    const problems = {
      'late-one': problem({ lastReviewed: '2026-06-01', srsIntervalDays: 3 }), // due 06-04
      'early-one': problem({ lastReviewed: '2026-05-20', srsIntervalDays: 1 }), // due 05-21
      'not-due': problem({ lastReviewed: '2026-06-08', srsIntervalDays: 30 }),
      mastered: problem({ status: 'Mastered', lastReviewed: '2026-01-01' }),
    }
    const due = getDueProblems(problems, '2026-06-09')
    expect(due.map((d) => d.slug)).toEqual(['early-one', 'late-one'])

    expect(getDueProblems(problems, '2026-06-09', 1).map((d) => d.slug)).toEqual(['early-one'])
  })
})

describe('newProblemDefaults', () => {
  it('starts at the first ladder rung, active, solved today', () => {
    const p = newProblemDefaults(
      { number: 42, title: 'X', url: 'u', difficulty: 'Medium', topics: [] },
      '2026-06-09',
    )
    expect(p.srsIntervalDays).toBe(DEFAULT_LADDER[0])
    expect(p.status).toBe('Active')
    expect(p.firstSolved).toBe('2026-06-09')
    expect(p.lastReviewed).toBe('2026-06-09')
    expect(p.timesReviewed).toBe(1)
  })
})

describe('mergeReview', () => {
  const base = { confidence: 4, notes: '', needReview: false, mastered: false }

  it('same-day rating counts as a solve, not a review', () => {
    const p = problem({ lastReviewed: '2026-06-09', timesReviewed: 1 })
    const out = mergeReview(p, { ...base, today: '2026-06-09' })
    expect(out.timesReviewed).toBe(1)
    expect(out.history.at(-1)?.type).toBe('solve')
  })

  it('a later-day review increments timesReviewed and advances the interval', () => {
    const p = problem({ lastReviewed: '2026-06-01', srsIntervalDays: 1, timesReviewed: 1 })
    const out = mergeReview(p, { ...base, today: '2026-06-09' })
    expect(out.timesReviewed).toBe(2)
    expect(out.srsIntervalDays).toBe(3)
    expect(out.lastReviewed).toBe('2026-06-09')
    expect(out.history.at(-1)?.type).toBe('review')
  })

  it('need-review keeps the interval rung', () => {
    const p = problem({ lastReviewed: '2026-06-01', srsIntervalDays: 7 })
    const out = mergeReview(p, { ...base, needReview: true, today: '2026-06-09' })
    expect(out.srsIntervalDays).toBe(7)
  })

  it('mastered sets status and freezes the interval', () => {
    const p = problem({ lastReviewed: '2026-06-01', srsIntervalDays: 14 })
    const out = mergeReview(p, { ...base, mastered: true, today: '2026-06-09' })
    expect(out.status).toBe('Mastered')
    expect(out.srsIntervalDays).toBe(14)
    expect(out.history.at(-1)?.mastered).toBe(true)
  })

  it('accumulates notes comma-separated', () => {
    const p = problem({ notes: 'two pointers' })
    const out = mergeReview(p, { ...base, notes: 'hash map', today: '2026-06-09' })
    expect(out.notes).toBe('two pointers, hash map')
  })

  it('keeps prior confidence when none given', () => {
    const p = problem({ latestConfidence: 3 })
    const out = mergeReview(p, { ...base, confidence: null, today: '2026-06-09' })
    expect(out.latestConfidence).toBe(3)
  })
})
