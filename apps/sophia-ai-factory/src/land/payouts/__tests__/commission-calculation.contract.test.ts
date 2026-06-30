/**
 * Contract tests: Affiliate Commission Calculation
 *
 * Verifies the tier-aware commission calculator contract:
 * - Commission rate for each tier level (BASIC=0.7x, PREMIUM=1x, ENTERPRISE=1.3x, MASTER=1.5x)
 * - 70/30 split of gross commission (calcCommission)
 * - Edge cases: zero commission, fractional cents rounding, refunds
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest'
import { calcCommission, calculateCommission } from '@/land/affiliates/commission-calculator'

describe('calcCommission — 70/30 gross split', () => {
  it('splits positive amount 70/30', () => {
    const result = calcCommission(100)
    expect(result.user).toBe(70)
    expect(result.sophia).toBe(30)
  })

  it('handles fractional amounts with 4dp precision', () => {
    const result = calcCommission(1.57)
    expect(result.user).toBe(1.099)
    expect(result.sophia).toBe(0.471)
  })

  it('user + sophia equals gross amount within float tolerance', () => {
    const gross = 99.99
    const result = calcCommission(gross)
    expect(Math.abs(result.user + result.sophia - gross)).toBeLessThan(0.001)
  })

  it('handles negative amounts (refunds) proportionally', () => {
    const result = calcCommission(-50)
    expect(result.user).toBe(-35)
    expect(result.sophia).toBe(-15)
  })

  it('handles zero amount', () => {
    const result = calcCommission(0)
    expect(result.user).toBe(0)
    expect(result.sophia).toBe(0)
  })

  it('handles very small amounts without precision loss', () => {
    const result = calcCommission(0.01)
    expect(result.user).toBe(0.007)
    expect(result.sophia).toBe(0.003)
  })
})

describe('calculateCommission — tier-aware multiplier', () => {
  const grossAmountUsd = 100
  const offerCommissionPct = 0.3 // 30% base

  it('BASIC tier applies 0.7x multiplier', () => {
    const result = calculateCommission({ grossAmountUsd, offerCommissionPct, tenantTier: 'BASIC' })
    // effectivePct = 0.3 * 0.7 = 0.21; commissionUsd = 100 * 0.21 = 21
    expect(result.commissionPct).toBe(0.21)
    expect(result.commissionUsd).toBe(21)
  })

  it('PREMIUM tier applies 1.0x multiplier (base rate)', () => {
    const result = calculateCommission({ grossAmountUsd, offerCommissionPct, tenantTier: 'PREMIUM' })
    expect(result.commissionPct).toBe(0.3)
    expect(result.commissionUsd).toBe(30)
  })

  it('ENTERPRISE tier applies 1.3x multiplier', () => {
    const result = calculateCommission({ grossAmountUsd, offerCommissionPct, tenantTier: 'ENTERPRISE' })
    // effectivePct = 0.3 * 1.3 = 0.39; commissionUsd = 100 * 0.39 = 39
    expect(result.commissionPct).toBe(0.39)
    expect(result.commissionUsd).toBe(39)
  })

  it('MASTER tier applies 1.5x multiplier', () => {
    const result = calculateCommission({ grossAmountUsd, offerCommissionPct, tenantTier: 'MASTER' })
    // effectivePct = 0.3 * 1.5 = 0.45 (float: 0.44999999999999996); commissionUsd = 100 * 0.45 = 45
    expect(result.commissionPct).toBeCloseTo(0.45, 10)
    expect(result.commissionUsd).toBe(45)
  })

  it('falls back to 1.0x for unknown tier', () => {
    const result = calculateCommission({ grossAmountUsd, offerCommissionPct, tenantTier: 'UNKNOWN_TIER' })
    expect(result.commissionPct).toBe(0.3)
    expect(result.commissionUsd).toBe(30)
  })

  it('caps effectivePct at 1.0 (100%) for high multiplier * high base', () => {
    const highResult = calculateCommission({ grossAmountUsd: 100, offerCommissionPct: 0.9, tenantTier: 'MASTER' })
    // 0.9 * 1.5 = 1.35, capped at 1.0
    expect(highResult.commissionPct).toBe(1.0)
    expect(highResult.commissionUsd).toBe(100)
  })

  it('rounds to 4 decimal places', () => {
    const result = calculateCommission({ grossAmountUsd: 99.99, offerCommissionPct: 1 / 3, tenantTier: 'PREMIUM' })
    // 99.99 * 0.3333... = 33.326666..., rounded to 4dp = 33.3267
    expect(result.commissionPct).toBeCloseTo(1 / 3, 4)
    expect(result.commissionUsd).toBeGreaterThan(0)
  })

  it('handles zero gross amount', () => {
    const result = calculateCommission({ grossAmountUsd: 0, offerCommissionPct, tenantTier: 'PREMIUM' })
    expect(result.commissionUsd).toBe(0)
    expect(result.commissionPct).toBe(0.3)
  })

  it('handles zero commission percentage', () => {
    const result = calculateCommission({ grossAmountUsd: 100, offerCommissionPct: 0, tenantTier: 'MASTER' })
    expect(result.commissionUsd).toBe(0)
    expect(result.commissionPct).toBe(0)
  })

  it('handles fractional cents correctly', () => {
    const result = calculateCommission({ grossAmountUsd: 0.01, offerCommissionPct: 0.5, tenantTier: 'PREMIUM' })
    // 0.01 * 0.5 = 0.005, rounded to 4dp = 0.005
    expect(result.commissionUsd).toBe(0.005)
  })
})
