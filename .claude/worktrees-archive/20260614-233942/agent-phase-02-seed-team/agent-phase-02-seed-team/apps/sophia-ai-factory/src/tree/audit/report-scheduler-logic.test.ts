/**
 * Tests for report-scheduler-logic (pure functions, no DB).
 *
 * Pins frequency → next-run-at math (daily/weekly/monthly/quarterly with
 * month-end correction for 29-31 day inputs) and filter validation.
 */

import { describe, it, expect } from 'vitest'
import { calculateNextRunAt, validateFilters } from './report-scheduler-logic'
import type { ReportFrequency, ReportFilters } from './report-scheduler-types'

const DAY_MS = 24 * 60 * 60 * 1000

describe('calculateNextRunAt', () => {
  it('daily → from + 24h', () => {
    const from = new Date('2026-05-11T12:00:00Z').getTime()
    expect(calculateNextRunAt('daily', from)).toBe(from + DAY_MS)
  })

  it('weekly → from + 7d', () => {
    const from = new Date('2026-05-11T12:00:00Z').getTime()
    expect(calculateNextRunAt('weekly', from)).toBe(from + 7 * DAY_MS)
  })

  it('monthly preserves day-of-month when target month has that day', () => {
    const from = new Date('2026-01-15T12:00:00Z').getTime()
    const result = new Date(calculateNextRunAt('monthly', from))
    expect(result.getUTCMonth()).toBe(1) // February
    expect(result.getUTCDate()).toBe(15)
  })

  it('monthly clamps Jan 31 → Feb 28 (non-leap year month-end correction)', () => {
    const from = new Date('2026-01-31T12:00:00Z').getTime()
    const result = new Date(calculateNextRunAt('monthly', from))
    expect(result.getUTCMonth()).toBe(1) // February
    expect(result.getUTCDate()).toBe(28)
  })

  it('monthly clamps Jan 31 → Feb 29 (2024 leap year)', () => {
    const from = new Date('2024-01-31T12:00:00Z').getTime()
    const result = new Date(calculateNextRunAt('monthly', from))
    expect(result.getUTCMonth()).toBe(1)
    expect(result.getUTCDate()).toBe(29)
  })

  it('monthly clamps Mar 31 → Apr 30 (30-day month)', () => {
    const from = new Date('2026-03-31T12:00:00Z').getTime()
    const result = new Date(calculateNextRunAt('monthly', from))
    expect(result.getUTCMonth()).toBe(3) // April
    expect(result.getUTCDate()).toBe(30)
  })

  it('quarterly advances 3 months preserving day-of-month', () => {
    const from = new Date('2026-01-15T12:00:00Z').getTime()
    const result = new Date(calculateNextRunAt('quarterly', from))
    expect(result.getUTCMonth()).toBe(3) // April (Jan + 3)
    expect(result.getUTCDate()).toBe(15)
  })

  it('quarterly clamps Nov 30 → Feb 28/29 (cross-year overflow)', () => {
    const from = new Date('2026-11-30T12:00:00Z').getTime()
    const result = new Date(calculateNextRunAt('quarterly', from))
    // Nov 30 + 3 months = Feb 30 → clamp to Feb 28 in 2027 (non-leap)
    expect(result.getUTCFullYear()).toBe(2027)
    expect(result.getUTCMonth()).toBe(1) // February
    expect(result.getUTCDate()).toBe(28)
  })

  it('throws on invalid frequency', () => {
    expect(() => calculateNextRunAt('yearly' as ReportFrequency, Date.now())).toThrow(
      /Invalid frequency: yearly/,
    )
  })

  it('uses Date.now() when from omitted', () => {
    const before = Date.now()
    const result = calculateNextRunAt('daily')
    const after = Date.now()
    expect(result).toBeGreaterThanOrEqual(before + DAY_MS)
    expect(result).toBeLessThanOrEqual(after + DAY_MS)
  })
})

describe('validateFilters', () => {
  it('accepts empty filter object', () => {
    expect(() => validateFilters({})).not.toThrow()
  })

  it('accepts startDate before endDate', () => {
    expect(() =>
      validateFilters({ startDate: 1_000, endDate: 2_000 } as ReportFilters),
    ).not.toThrow()
  })

  it('accepts startDate equal to endDate (single-day range)', () => {
    expect(() =>
      validateFilters({ startDate: 1_000, endDate: 1_000 } as ReportFilters),
    ).not.toThrow()
  })

  it('throws when startDate > endDate', () => {
    expect(() =>
      validateFilters({ startDate: 2_000, endDate: 1_000 } as ReportFilters),
    ).toThrow(/startDate must be before endDate/)
  })

  it('throws when modelNames is empty array', () => {
    expect(() => validateFilters({ modelNames: [] } as ReportFilters)).toThrow(
      /modelNames array cannot be empty/,
    )
  })

  it('accepts non-empty modelNames', () => {
    expect(() =>
      validateFilters({ modelNames: ['gpt-4o'] } as ReportFilters),
    ).not.toThrow()
  })

  it('throws when tiers is empty array', () => {
    expect(() => validateFilters({ tiers: [] } as ReportFilters)).toThrow(
      /tiers array cannot be empty/,
    )
  })

  it('accepts non-empty tiers', () => {
    expect(() =>
      validateFilters({ tiers: ['PREMIUM'] } as ReportFilters),
    ).not.toThrow()
  })

  it('ignores undefined arrays (only validates when present)', () => {
    expect(() =>
      validateFilters({ modelNames: undefined, tiers: undefined } as ReportFilters),
    ).not.toThrow()
  })
})
