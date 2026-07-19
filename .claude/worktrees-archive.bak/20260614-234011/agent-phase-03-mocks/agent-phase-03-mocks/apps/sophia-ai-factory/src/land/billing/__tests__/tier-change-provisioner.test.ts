import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateProRataCredit } from '../tier-change-provisioner'

describe('calculateProRataCredit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 when period has ended', () => {
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
    const credit = calculateProRataCredit(
      39900,
      '2026-05-01T00:00:00Z',
      '2026-05-31T00:00:00Z',
    )
    expect(credit).toBe(0)
  })

  it('returns 0 when period has not started', () => {
    vi.setSystemTime(new Date('2026-04-30T00:00:00Z'))
    const credit = calculateProRataCredit(
      39900,
      '2026-05-01T00:00:00Z',
      '2026-05-31T00:00:00Z',
    )
    expect(credit).toBe(0)
  })

  it('returns full price at period start', () => {
    vi.setSystemTime(new Date('2026-05-01T00:00:01Z'))
    const credit = calculateProRataCredit(
      39900,
      '2026-05-01T00:00:00Z',
      '2026-05-31T00:00:00Z',
    )
    expect(credit).toBeGreaterThan(39800)
    expect(credit).toBeLessThanOrEqual(39900)
  })

  it('returns half price at midpoint', () => {
    vi.setSystemTime(new Date('2026-05-16T00:00:00Z'))
    const credit = calculateProRataCredit(
      39900,
      '2026-05-01T00:00:00Z',
      '2026-05-31T00:00:00Z',
    )
    expect(credit).toBe(19950)
  })

  it('returns ~0 near period end', () => {
    vi.setSystemTime(new Date('2026-05-30T23:00:00Z'))
    const credit = calculateProRataCredit(
      39900,
      '2026-05-01T00:00:00Z',
      '2026-05-31T00:00:00Z',
    )
    expect(credit).toBeLessThan(1500)
    expect(credit).toBeGreaterThanOrEqual(0)
  })

  it('calculates correctly for ENTERPRISE price', () => {
    vi.setSystemTime(new Date('2026-05-16T00:00:00Z'))
    const credit = calculateProRataCredit(
      79900,
      '2026-05-01T00:00:00Z',
      '2026-05-31T00:00:00Z',
    )
    expect(credit).toBe(39950)
  })
})
