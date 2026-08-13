/**
 * Regression tests: stackedPeriodEnd — duplicate/same-tier re-payments must
 * APPEND to remaining time, never reset the clock (double-charge bug).
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest'
import { stackedPeriodEnd } from '@/land/billing/nowpayments-ipn-subscription'

const NOW = '2026-08-13T00:00:00Z'

describe('stackedPeriodEnd', () => {
  it('returns default when no existing end (new sub)', () => {
    expect(stackedPeriodEnd(null, 'monthly', NOW, '2026-09-12T00:00:00Z'))
      .toBe('2026-09-12T00:00:00Z')
  })

  it('returns default when existing end is in the past (expired)', () => {
    expect(stackedPeriodEnd('2026-08-01T00:00:00Z', 'monthly', NOW, '2026-09-12T00:00:00Z'))
      .toBe('2026-09-12T00:00:00Z')
  })

  it('STACKS monthly on top of remaining time (the double-charge fix)', () => {
    // existing sub still has 10 days left (ends 08-23); re-payment must end 09-22
    const result = stackedPeriodEnd('2026-08-23T00:00:00Z', 'monthly', NOW, '2026-09-12T00:00:00Z')
    expect(result).toBe('2026-09-22T00:00:00.000Z')
  })

  it('STACKS yearly on top of remaining time', () => {
    // existing ends 2026-12-01 (109 days left); +365d → 2027-12-01
    const result = stackedPeriodEnd('2026-12-01T00:00:00Z', 'yearly', NOW, '2027-08-13T00:00:00Z')
    expect(result).toBe('2027-12-01T00:00:00.000Z')
  })

  it('lifetime always returns default (2099 sentinel)', () => {
    expect(stackedPeriodEnd('2026-08-23T00:00:00Z', 'lifetime', NOW, '2099-12-31T23:59:59Z'))
      .toBe('2099-12-31T23:59:59Z')
  })

  it('handles invalid existing end gracefully', () => {
    expect(stackedPeriodEnd('garbage', 'monthly', NOW, '2026-09-12T00:00:00Z'))
      .toBe('2026-09-12T00:00:00Z')
    expect(stackedPeriodEnd(undefined, 'monthly', NOW, '2026-09-12T00:00:00Z'))
      .toBe('2026-09-12T00:00:00Z')
  })
})
