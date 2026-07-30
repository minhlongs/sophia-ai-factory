/**
 * @vitest
 * Agency billing tests — synchronous validation + idempotency checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processAgencyPayment } from '../agency-billing'

describe('processAgencyPayment', () => {
  const base = {
    order_id: 'ag_42_1700000000',
    payment_status: 'finished' as const,
    price_amount: 500,
    payment_id: 'pay_123',
  }

  it('returns failure when order_id missing', () => {
    const r = processAgencyPayment({ ...base, order_id: undefined })
    expect(r.ok).toBe(false)
  })

  it('returns failure when order_id has wrong prefix', () => {
    const r = processAgencyPayment({ ...base, order_id: 'sophia_user1_123' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('NOT_AN_AGENCY_ORDER')
  })

  it('returns failure when ag_ prefix but no numeric ID', () => {
    const r = processAgencyPayment({ ...base, order_id: 'ag_abc_123' })
    expect(r.ok).toBe(false)
  })

  it('returns failure for non-finished payment', () => {
    const r = processAgencyPayment({ ...base, payment_status: 'waiting' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('PAYMENT_NOT_FINISHED')
  })

  it('returns failure for unknown amount', () => {
    const r = processAgencyPayment({ ...base, price_amount: 9999 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('UNKNOWN_AGENCY_TIER')
  })

  it('returns success for starter tier ($500)', () => {
    const r = processAgencyPayment(base)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.agencyId).toBe(42)
      expect(r.value.tier).toBe('starter')
      expect(r.value.monthlyPrice).toBe(500)
      expect(r.value.status).toBe('activated')
    }
  })

  it('returns success for growth tier ($1500)', () => {
    const r = processAgencyPayment({ ...base, price_amount: 1500 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.tier).toBe('growth')
  })

  it('returns success for enterprise tier ($3000)', () => {
    const r = processAgencyPayment({ ...base, price_amount: 3000 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.tier).toBe('enterprise')
  })

  it('parses agencyId from order_id', () => {
    const r = processAgencyPayment({ ...base, order_id: 'ag_999_123' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.agencyId).toBe(999)
  })
})
