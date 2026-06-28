import { describe, it, expect } from 'vitest'
import { calculateDiscount } from '../promo-discount-calculator'

describe('calculateDiscount', () => {
  it('percent_off: 20% off $199 = $39.80 discount', () => {
    const result = calculateDiscount({
      discountType: 'percent_off',
      discountValue: 20,
      originalAmountCents: 19900,
    })
    expect(result.discountCents).toBe(3980)
    expect(result.finalAmountCents).toBe(15920)
    expect(result.trialDays).toBe(0)
    expect(result.isFreeOrder).toBe(false)
  })

  it('percent_off: 100% = free order', () => {
    const result = calculateDiscount({
      discountType: 'percent_off',
      discountValue: 100,
      originalAmountCents: 19900,
    })
    expect(result.discountCents).toBe(19900)
    expect(result.finalAmountCents).toBe(0)
    expect(result.isFreeOrder).toBe(true)
  })

  it('percent_off: clamps above 100', () => {
    const result = calculateDiscount({
      discountType: 'percent_off',
      discountValue: 150,
      originalAmountCents: 10000,
    })
    expect(result.discountCents).toBe(10000)
    expect(result.isFreeOrder).toBe(true)
  })

  it('fixed_off: $50 off $199', () => {
    const result = calculateDiscount({
      discountType: 'fixed_off',
      discountValue: 50,
      originalAmountCents: 19900,
    })
    expect(result.discountCents).toBe(5000)
    expect(result.finalAmountCents).toBe(14900)
  })

  it('fixed_off: caps at original amount', () => {
    const result = calculateDiscount({
      discountType: 'fixed_off',
      discountValue: 300,
      originalAmountCents: 19900,
    })
    expect(result.discountCents).toBe(19900)
    expect(result.finalAmountCents).toBe(0)
    expect(result.isFreeOrder).toBe(true)
  })

  it('free_trial: 14 days, no price change', () => {
    const result = calculateDiscount({
      discountType: 'free_trial',
      discountValue: 14,
      originalAmountCents: 19900,
    })
    expect(result.discountCents).toBe(0)
    expect(result.finalAmountCents).toBe(19900)
    expect(result.trialDays).toBe(14)
    expect(result.isFreeOrder).toBe(false)
  })

  it('free_full: entire order free', () => {
    const result = calculateDiscount({
      discountType: 'free_full',
      discountValue: 0,
      originalAmountCents: 79900,
    })
    expect(result.discountCents).toBe(79900)
    expect(result.finalAmountCents).toBe(0)
    expect(result.isFreeOrder).toBe(true)
  })
})
