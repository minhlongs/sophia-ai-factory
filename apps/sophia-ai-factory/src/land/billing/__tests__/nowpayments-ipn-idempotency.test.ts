/**
 * NOWPayments IPN idempotency tests.
 * Verifies that replayed IPN events do not double-activate tiers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processNowPaymentsIpn } from '../nowpayments-ipn-handlers'

// Track how many times handleFinished is called
const handleFinishedSpy = vi.fn().mockResolvedValue(undefined)
const handleFailedSpy = vi.fn().mockResolvedValue(undefined)

// processed state per payment_id
const processedPayments = new Set<string>()

vi.mock('../nowpayments-ipn-db', () => ({
  isPaymentProcessed: vi.fn(async (id: string) => processedPayments.has(id)),
  recordIpnEvent: vi.fn(async (id: string, _status: string, _payload: unknown, processed: boolean) => {
    if (processed) processedPayments.add(id)
  }),
  getDb: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null }) })) })),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: null }) })),
    })),
  })),
  parseUserIdFromOrderId: vi.fn(() => 'user123'),
}))

vi.mock('../nowpayments-ipn-dispatch', () => ({
  dispatchFinished: vi.fn(async () => handleFinishedSpy()),
  dispatchRefunded: vi.fn(),
}))

vi.mock('../nowpayments-ipn-subscription', () => ({
  handleFailed: vi.fn(async () => handleFailedSpy()),
  handleRefunded: vi.fn().mockResolvedValue(undefined),
}))

const baseIpn = {
  payment_id: 'pay_idempotency_test',
  payment_status: 'finished' as const,
  price_amount: 399,
  price_currency: 'USD',
  invoice_id: '4559269964',
  order_id: 'sophia_user123_1700000000000',
  actually_paid: 399,
}

beforeEach(() => {
  processedPayments.clear()
  handleFinishedSpy.mockClear()
  handleFailedSpy.mockClear()
})

describe('IPN idempotency', () => {
  it('processes the first call and returns success', async () => {
    const result = await processNowPaymentsIpn(baseIpn)
    expect(result.success).toBe(true)
    expect(handleFinishedSpy).toHaveBeenCalledTimes(1)
  })

  it('skips processing on replay (same payment_id)', async () => {
    await processNowPaymentsIpn(baseIpn)
    handleFinishedSpy.mockClear()

    const result = await processNowPaymentsIpn(baseIpn)
    expect(result.success).toBe(true)
    expect(result.message).toContain('Already processed')
    expect(handleFinishedSpy).not.toHaveBeenCalled()
  })

  it('processes different payment_ids independently', async () => {
    await processNowPaymentsIpn(baseIpn)
    const result2 = await processNowPaymentsIpn({ ...baseIpn, payment_id: 'pay_different_id' })
    expect(result2.success).toBe(true)
    expect(handleFinishedSpy).toHaveBeenCalledTimes(2)
  })

  it('returns success=true on replay (idempotent — not an error)', async () => {
    await processNowPaymentsIpn(baseIpn)
    const replay = await processNowPaymentsIpn(baseIpn)
    expect(replay.success).toBe(true) // should not be error
  })

  it('handles failed payment status', async () => {
    const failedIpn = { ...baseIpn, payment_id: 'pay_failed', payment_status: 'failed' as const }
    const result = await processNowPaymentsIpn(failedIpn)
    expect(result.success).toBe(true)
    expect(handleFailedSpy).toHaveBeenCalledTimes(1)
  })

  it('does not process expired payment (but returns success)', async () => {
    const expiredIpn = { ...baseIpn, payment_id: 'pay_expired', payment_status: 'expired' as const }
    const result = await processNowPaymentsIpn(expiredIpn)
    expect(result.success).toBe(true)
    expect(handleFinishedSpy).not.toHaveBeenCalled()
  })
})
