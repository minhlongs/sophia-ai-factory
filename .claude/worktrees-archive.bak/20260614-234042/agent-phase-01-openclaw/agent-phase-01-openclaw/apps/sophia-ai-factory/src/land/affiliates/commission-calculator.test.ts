/**
 * Tests for commission-calculator
 */

import { describe, it, expect } from 'vitest'
import { calcCommission } from './commission-calculator'

describe('calcCommission', () => {
  it('splits a positive amount 70/30', () => {
    const result = calcCommission(100)
    expect(result.user).toBe(70)
    expect(result.sophia).toBe(30)
  })

  it('handles fractional amounts with 4dp precision', () => {
    const result = calcCommission(120.00)
    expect(result.user).toBe(84)
    expect(result.sophia).toBe(36)
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

  it('user + sophia equals gross amount (within float tolerance)', () => {
    const gross = 99.99
    const result = calcCommission(gross)
    expect(Math.abs(result.user + result.sophia - gross)).toBeLessThan(0.001)
  })

  it('handles small fractional commission', () => {
    const result = calcCommission(1.57)
    expect(result.user).toBe(1.099)
    expect(result.sophia).toBe(0.471)
  })
})
