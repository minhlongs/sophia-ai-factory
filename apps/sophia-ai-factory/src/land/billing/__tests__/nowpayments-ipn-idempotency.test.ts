/**
 * NOWPayments IPN idempotency tests.
 * Verifies that replayed IPN events do not double-activate tiers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processNowPaymentsIpn } from '../nowpayments-ipn-handlers'

// Track how many times handleFinished is called
const handleFinishedSpy = vi.fn().mockResolvedValue(undefined)
const handleFailedSpy = vi.fn().mockResolvedValue(undefined)

// processed state per payment_id (eventId → { processed, created_at })
const mockDbEvents = new Map<string, { event_id: string; event_type: string; payload: string; processed: number; created_at: string }>()
const mockRefundBarriers = new Set<string>()
let selectShouldReturnNull = false

function buildMockDb() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'pending_orders') {
        return {
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        }
      }
      if (table !== 'payment_events') {
        throw new Error(`Unexpected table mock: ${table}`)
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      }
    }),
    // Phase 2 PayOS-style: raw SQL via prepare()
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: unknown[]) => {
        // Extract eventId from INSERT args (arg ?1) or SELECT args (arg ?1)
        const eventId = args[0] as string
        return {
          /** INSERT ... ON CONFLICT DO NOTHING → { meta: { changes } } */
          run: vi.fn(async () => {
            if (sql.includes('INSERT INTO payment_events')) {
              if (mockDbEvents.has(eventId)) {
                // Duplicate — ON CONFLICT DO NOTHING fires
                return { meta: { changes: 0 } }
              }
              // Fresh insert — lock acquired
              mockDbEvents.set(eventId, {
                event_id: eventId,
                event_type: String(args[1]),
                payload: String(args[2]),
                processed: 0,
                created_at: String(args[3]),
              })
              return { meta: { changes: 1 } }
            }
            if (sql.includes('INSERT INTO nowpayments_refund_barriers')) {
              mockRefundBarriers.add(eventId)
              return { meta: { changes: 1 } }
            }
            if (sql.includes('UPDATE payment_events') && sql.includes('processed = 0')) {
              const lockId = args[3] as string
              const row = mockDbEvents.get(lockId)
              if (row?.processed === 1 && row.event_type === args[4]) {
                row.event_type = String(args[0])
                row.payload = String(args[1])
                row.processed = 0
                row.created_at = String(args[2])
                return { meta: { changes: 1 } }
              }
              return { meta: { changes: 0 } }
            }
            if (sql.includes('UPDATE payment_events') && sql.includes('processed = 1')) {
              const lockId = sql.includes('WHERE event_id = ?3') ? args[2] as string : eventId
              const row = mockDbEvents.get(lockId)
              if (row) {
                if (sql.includes('event_type = ?1')) {
                  row.event_type = String(args[0])
                  row.payload = String(args[1])
                }
                row.processed = 1
                return { meta: { changes: 1 } }
              }
              return { meta: { changes: 0 } }
            }
            if (sql.includes('DELETE FROM payment_events')) {
              mockDbEvents.delete(eventId)
              return { meta: { changes: 1 } }
            }
            return { meta: { changes: 1 } }
          }),
          /** SELECT processed, created_at → row or null */
          first: vi.fn(async () => {
            if (selectShouldReturnNull) return null
            if (sql.includes('FROM nowpayments_refund_barriers')) {
              return mockRefundBarriers.has(eventId) ? { payment_id: eventId } : null
            }
            const row = mockDbEvents.get(eventId)
            return row
              ? { processed: row.processed, created_at: row.created_at, event_type: row.event_type }
              : null
          }),
        }
      }),
    })),
  }
}

vi.mock('../nowpayments-ipn-db', () => ({
  getDb: vi.fn(() => buildMockDb()),
  parseUserIdFromOrderId: vi.fn(() => 'user123'),
}))

vi.mock('../nowpayments-ipn-dispatch', () => ({
  dispatchFinished: vi.fn(async () => handleFinishedSpy()),
  dispatchRefunded: vi.fn(),
}))

vi.mock('../nowpayments-ipn-subscription', () => ({
  handleFailed: vi.fn(async () => { await handleFailedSpy(); return { ok: true, value: undefined } }),
  handleRefunded: vi.fn().mockResolvedValue({ ok: true, value: undefined } as const),
}))

const baseIpn = {
  payment_id: 'pay_idempotency_test',
  payment_status: 'finished' as const,
  price_amount: 399,
  price_currency: 'USD',
  pay_amount: 399,
  pay_currency: 'USDT',
  invoice_id: '4559269964',
  order_id: 'sophia_user123_1700000000000',
  actually_paid: 399,
}

beforeEach(() => {
  mockDbEvents.clear()
  mockRefundBarriers.clear()
  handleFinishedSpy.mockClear()
  handleFailedSpy.mockClear()
  selectShouldReturnNull = false
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
    mockDbEvents.set(eventId, {
      event_id: eventId,
      event_type: 'nowpayments.finished',
      payload: JSON.stringify(baseIpn),
      processed: 0,
      created_at: new Date().toISOString(),
    })

    const result = await processNowPaymentsIpn(baseIpn)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Already processing')
  })

  it('returns success=false and message "Database query failure" when db select fails', async () => {
    // Insert event with processed = 0 to trigger ON CONFLICT path
    const eventId = `nowpayments_${baseIpn.payment_id}_${baseIpn.payment_status}`
    mockDbEvents.set(eventId, {
      event_id: eventId,
      event_type: 'nowpayments.finished',
      payload: JSON.stringify(baseIpn),
      processed: 0,
      created_at: new Date().toISOString(),
    })
    selectShouldReturnNull = true

    const result = await processNowPaymentsIpn(baseIpn)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Database query failure')
  })

  it('persists a refund barrier and ignores a delayed finished event', async () => {
    const paymentId = 'pay_refunded_before_finished'
    const refundResult = await processNowPaymentsIpn({ ...baseIpn, payment_id: paymentId, payment_status: 'refunded' })
    expect(refundResult.success).toBe(true)
    expect(mockRefundBarriers.has(paymentId)).toBe(true)

    // Exercise the durable tombstone independently of the event-lock row.
    mockDbEvents.delete(`nowpayments_terminal_${paymentId}`)

    handleFinishedSpy.mockClear()
    const lateFinish = await processNowPaymentsIpn({ ...baseIpn, payment_id: paymentId, payment_status: 'finished' })

    expect(lateFinish.success).toBe(true)
    expect(lateFinish.message).toContain('after refund')
    expect(handleFinishedSpy).not.toHaveBeenCalled()
  })

  it('allows a refund to follow a successfully processed finished payment', async () => {
    const paymentId = 'pay_finished_then_refunded'
    expect((await processNowPaymentsIpn({ ...baseIpn, payment_id: paymentId })).success).toBe(true)

    const refundResult = await processNowPaymentsIpn({ ...baseIpn, payment_id: paymentId, payment_status: 'refunded' })

    expect(refundResult.success).toBe(true)
    expect(mockRefundBarriers.has(paymentId)).toBe(true)
    expect(mockDbEvents.get(`nowpayments_terminal_${paymentId}`)?.event_type).toBe('nowpayments.terminal.refunded')
  })
})
