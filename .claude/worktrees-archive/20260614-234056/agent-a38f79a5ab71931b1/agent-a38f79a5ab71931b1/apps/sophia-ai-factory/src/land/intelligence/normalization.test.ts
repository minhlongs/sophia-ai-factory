import { describe, it, expect } from 'vitest'
import {
  normalizeCommission,
  normalizeClickBankGravity,
  normalizeShareASaleRank,
  normalizeReliability,
} from './normalization'

describe('normalizeCommission', () => {
  it('should return 0 for null or undefined', () => {
    expect(normalizeCommission(null)).toBe(0)
    expect(normalizeCommission(undefined)).toBe(0)
  })

  it('should return 0 for negative values', () => {
    expect(normalizeCommission(-10)).toBe(0)
  })

  it('should return 0 for zero', () => {
    expect(normalizeCommission(0)).toBe(0)
  })

  it('should scale linearly up to $150', () => {
    // $50 -> 33.33
    expect(normalizeCommission(50)).toBeCloseTo(33.33, 1)
    // $100 -> 66.67
    expect(normalizeCommission(100)).toBeCloseTo(66.67, 1)
    // $150 -> 100
    expect(normalizeCommission(150)).toBe(100)
  })

  it('should cap at 100 for values above $150', () => {
    expect(normalizeCommission(200)).toBe(100)
    expect(normalizeCommission(500)).toBe(100)
  })
})

describe('normalizeClickBankGravity', () => {
  it('should return 0 for null, undefined, or zero', () => {
    expect(normalizeClickBankGravity(null)).toBe(0)
    expect(normalizeClickBankGravity(undefined)).toBe(0)
    expect(normalizeClickBankGravity(0)).toBe(0)
  })

  it('should return 0 for negative values', () => {
    expect(normalizeClickBankGravity(-5)).toBe(0)
  })

  it('should produce increasing scores for increasing gravity', () => {
    const score10 = normalizeClickBankGravity(10)
    const score50 = normalizeClickBankGravity(50)
    const score100 = normalizeClickBankGravity(100)
    const score500 = normalizeClickBankGravity(500)

    expect(score10).toBeGreaterThan(0)
    expect(score50).toBeGreaterThan(score10)
    expect(score100).toBeGreaterThan(score50)
    expect(score500).toBeGreaterThan(score100)
  })

  it('should cap at 100', () => {
    const score = normalizeClickBankGravity(10000)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('should give moderate scores for moderate gravity', () => {
    // Gravity 50 should be around 50-70 range
    const score = normalizeClickBankGravity(50)
    expect(score).toBeGreaterThan(50)
    expect(score).toBeLessThan(75)
  })
})

describe('normalizeShareASaleRank', () => {
  it('should return 0 for null, undefined, or zero', () => {
    expect(normalizeShareASaleRank(null)).toBe(0)
    expect(normalizeShareASaleRank(undefined)).toBe(0)
    expect(normalizeShareASaleRank(0)).toBe(0)
  })

  it('should return 0 for negative values', () => {
    expect(normalizeShareASaleRank(-1)).toBe(0)
  })

  it('should give highest scores for lowest ranks', () => {
    const rank1 = normalizeShareASaleRank(1)
    const rank50 = normalizeShareASaleRank(50)
    const rank100 = normalizeShareASaleRank(100)

    expect(rank1).toBeGreaterThan(99)
    expect(rank50).toBeGreaterThan(rank100)
    expect(rank100).toBe(90)
  })

  it('should score around 50 for rank 1000', () => {
    const score = normalizeShareASaleRank(1000)
    expect(score).toBeCloseTo(50, 0)
  })

  it('should score 0 for rank 5000 or above', () => {
    expect(normalizeShareASaleRank(5000)).toBe(0)
    expect(normalizeShareASaleRank(10000)).toBe(0)
  })

  it('should produce decreasing scores for increasing ranks', () => {
    const scores = [1, 50, 100, 500, 1000, 3000, 5000].map(normalizeShareASaleRank)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    }
  })
})

describe('normalizeReliability', () => {
  it('should return 80 for products with recurring revenue', () => {
    expect(normalizeReliability({ recurring: true })).toBe(80)
    expect(normalizeReliability({ totalRebillAmt: 10 })).toBe(80)
  })

  it('should return 50 (neutral default) for non-recurring products', () => {
    expect(normalizeReliability({})).toBe(50)
    expect(normalizeReliability({ someOtherMetric: 42 })).toBe(50)
  })

  it('should return 50 when totalRebillAmt is 0', () => {
    expect(normalizeReliability({ totalRebillAmt: 0 })).toBe(50)
  })
})
