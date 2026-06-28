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
const mockDbEvents = new Map<string, { event_id: string; processed: number }>()
let selectShouldFail = false

vi.mock('../nowpayments-ipn-db', () => ({
  getDb: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table !== 'payment_events') {
        throw new Error(`Unexpected table mock: ${table}`)
      }
      return {
        insert: vi.fn(async (row: { event_id: string; processed: number }) => {
          if (mockDbEvents.has(row.event_id)) {
            return { error: new Error('Unique constraint violation') }
          }
          mockDbEvents.set(row.event_id, { ...row })
          return { error: null }
        }),
        select: vi.fn(() => ({
          eq: vi.fn((col: string, val: string) => ({
            single: vi.fn(async () => {
              if (selectShouldFail) {
                return { data: null, error: new Error('Select failed') }
              }
              const row = mockDbEvents.get(val)
              return { data: row ? { processed: row.processed } : null, error: null }
            })
          }))
        })),
        update: vi.fn((updates: { processed: number }) => ({
          eq: vi.fn(async (col: string, val: string) => {
            const row = mockDbEvents.get(val)
            if (row) {
              row.processed = updates.processed
              mockDbEvents.set(val, row)
            }
            return { error: null }
          })
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(async (col: string, val: string) => {
            mockDbEvents.delete(val)
            return { error: null }
          })
        }))
      }
    })
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
  mockDbEvents.clear()
  handleFinishedSpy.mockClear()
  handleFailedSpy.mockClear()
  selectShouldFail = false
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

  it('returns success=false and message "Already processing" when processed = 0', async () => {
    // Insert event with processed = 0
    const eventId = `nowpayments_${baseIpn.payment_id}_${baseIpn.payment_status}`
    mockDbEvents.set(eventId, { event_id: eventId, processed: 0 })

    const result = await processNowPaymentsIpn(baseIpn)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Already processing')
  })

  it('returns success=false and message "Database query failure" when db select fails', async () => {
    // Insert event with processed = 0 to trigger select fallback
    const eventId = `nowpayments_${baseIpn.payment_id}_${baseIpn.payment_status}`
    mockDbEvents.set(eventId, { event_id: eventId, processed: 0 })
    selectShouldFail = true

    const result = await processNowPaymentsIpn(baseIpn)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Database query failure')
  })
})
