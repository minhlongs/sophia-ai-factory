/**
 * Contract tests for commission-calculator
 *
 * Tests both the base 70/30 split (calcCommission) and tier-aware
 * commission calculation (calculateCommission).
 *
 * @module affiliates/__tests__/commission-calculator-contract
 */

import { describe, it, expect } from 'vitest'
import { calcCommission, calculateCommission } from '../commission-calculator'

describe('calcCommission (70/30 split)', () => {
  it('splits positive gross 70/30: $100 -> user $70, sophia $30', () => {
    const result = calcCommission(100)
    expect(result.user).toBe(70)
    expect(result.sophia).toBe(30)
  })

  it('splits negative gross (refund) proportionally: -$50 -> -$35, -$15', () => {
    const result = calcCommission(-50)
    expect(result.user).toBe(-35)
    expect(result.sophia).toBe(-15)
  })

  it('returns zeros for zero amount', () => {
    const result = calcCommission(0)
    expect(result.user).toBe(0)
    expect(result.sophia).toBe(0)
  })

  it('rounds to 4 decimal places', () => {
    const result = calcCommission(1.23456789)
    expect(result.user).toBe(0.8642)
    expect(result.sophia).toBe(0.3704)
  })
})

describe('calculateCommission (tier-aware)', () => {
  it('applies BASIC multiplier 0.7x', () => {
    const result = calculateCommission({
      grossAmountUsd: 100,
      offerCommissionPct: 0.3,
      tenantTier: 'BASIC',
    })
    // 100 * (0.3 * 0.7) = 100 * 0.21 = 21
    expect(result.commissionUsd).toBe(21)
    expect(result.commissionPct).toBeCloseTo(0.21, 4)
  })

  it('applies ENTERPRISE multiplier 1.3x', () => {
    const result = calculateCommission({
      grossAmountUsd: 100,
      offerCommissionPct: 0.3,
      tenantTier: 'ENTERPRISE',
    })
    // 100 * (0.3 * 1.3) = 100 * 0.39 = 39
    expect(result.commissionUsd).toBe(39)
    expect(result.commissionPct).toBeCloseTo(0.39, 4)
  })

  it('applies MASTER multiplier 1.5x', () => {
    const result = calculateCommission({
      grossAmountUsd: 100,
      offerCommissionPct: 0.3,
      tenantTier: 'MASTER',
    })
    // 100 * (0.3 * 1.5) = 100 * 0.45 = 45
    expect(result.commissionUsd).toBe(45)
    expect(result.commissionPct).toBeCloseTo(0.45, 4)
  })

  it('defaults unknown tier to 1.0x', () => {
    const result = calculateCommission({
      grossAmountUsd: 100,
      offerCommissionPct: 0.3,
      tenantTier: 'UNKNOWN_TIER',
    })
    // 100 * (0.3 * 1.0) = 100 * 0.3 = 30
    expect(result.commissionUsd).toBe(30)
    expect(result.commissionPct).toBeCloseTo(0.3, 4)
  })

  it('caps effective commission at 1.0', () => {
    const result = calculateCommission({
      grossAmountUsd: 100,
      offerCommissionPct: 0.8,
      tenantTier: 'MASTER',
    })
    // 0.8 * 1.5 = 1.2, capped at 1.0
    expect(result.commissionUsd).toBe(100)
    expect(result.commissionPct).toBe(1.0)
  })

  it('rounds to 4 decimal places', () => {
    const result = calculateCommission({
      grossAmountUsd: 1.23456789,
      offerCommissionPct: 0.3,
      tenantTier: 'BASIC',
    })
    // 1.23456789 * (0.3 * 0.7) = 1.23456789 * 0.21 = 0.2592592569
    // rounded to 4dp = 0.2593
    expect(result.commissionUsd).toBe(0.2593)
  })
})
