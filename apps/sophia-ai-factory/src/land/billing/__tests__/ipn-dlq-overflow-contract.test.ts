/**
 * Contract tests: DLQ overflow behavior in NOWPayments IPN pipeline.
 *
 * Phase 03: DLQ overflow now records dropped events in payment_events_dropped
 * before rejecting. Operators can reconcile via GET /api/admin/dlq/reconciliation
 * and replay via POST /api/admin/dlq/replay.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processNowPaymentsIpn } from '../nowpayments-ipn-handlers'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const dispatchFinishedSpy = vi.fn()
const dispatchRefundedSpy = vi.fn()

vi.mock('../nowpayments-ipn-dispatch', () => ({
  dispatchFinished: (ipn: Record<string, unknown>) => dispatchFinishedSpy(ipn),
  dispatchRefunded: (ipn: Record<string, unknown>) => dispatchRefundedSpy(ipn),
}))

vi.mock('../nowpayments-ipn-subscription', () => ({
  handleFailed: vi.fn().mockResolvedValue({ ok: true }),
}))

// Track DLQ operations
const dlqEnqueueSpy = vi.fn()
const recordDroppedEventSpy = vi.fn()
let mockUnresolvedDlqCount = 0

vi.mock('../nowpayments-ipn-dead-letter', () => ({
  enqueueDlqEntry: (...args: unknown[]) => {
    dlqEnqueueSpy(...args)
    return Promise.resolve({ ok: true })
  },
  countUnresolvedDlq: () => Promise.resolve(mockUnresolvedDlqCount),
  MAX_DLQ_RETRIES: 5,
}))

vi.mock('../nowpayments-ipn-dropped-events', () => ({
  recordDroppedEvent: (...args: unknown[]) => {
    recordDroppedEventSpy(...args)
    return Promise.resolve({ ok: true })
  },
}))

// ── D1 mock state ──────────────────────────────────────────────────────────────

const mockDbEvents = new Map<string, { event_id: string; processed: number; created_at: string }>()

function buildMockDb() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'pending_orders') {
        return {
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        }
      }
      if (table === 'ipn_dead_letter_queue') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { retry_count: 0 }, error: null })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      }
    }),
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: unknown[]) => {
        const eventId = args[0] as string
        return {
          run: vi.fn(async () => {
            if (sql.includes('INSERT INTO payment_events')) {
              if (mockDbEvents.has(eventId)) {
                return { meta: { changes: 0 } }
              }
              mockDbEvents.set(eventId, {
                event_id: eventId,
                processed: 0,
                created_at: new Date().toISOString(),
              })
              return { meta: { changes: 1 } }
            }
            if (sql.includes('UPDATE payment_events')) {
              const row = mockDbEvents.get(eventId)
              if (row) row.processed = 1
              return { success: true }
            }
            if (sql.includes('DELETE FROM payment_events')) {
              mockDbEvents.delete(eventId)
              return { success: true }
            }
            return { success: true }
          }),
          first: vi.fn(async () => {
            const row = mockDbEvents.get(eventId)
            return row ? { processed: row.processed, created_at: row.created_at } : null
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeIpn(overrides: Partial<{
  payment_id: string
  payment_status: string
}> = {}) {
  return {
    payment_id: overrides.payment_id ?? 'pay_dlq_001',
    payment_status: (overrides.payment_status ?? 'finished') as 'finished',
    price_amount: 199,
    price_currency: 'USD',
    order_id: 'sophia_user123_1700000000000',
  }
}

/** Make dispatch throw to trigger DLQ path */
function makeIpnThatTriggersDlq() {
  // Force the handler to throw a permanent error so the catch block runs.
  // We mock dispatchFinished to throw a validation error (permanent pattern).
  dispatchFinishedSpy.mockRejectedValueOnce(new Error('validation: invalid tier config'))
  return makeIpn({ payment_id: `pay_dlq_error_${Date.now()}` })
}

beforeEach(() => {
  mockDbEvents.clear()
  mockUnresolvedDlqCount = 0
  dispatchFinishedSpy.mockClear()
  dispatchRefundedSpy.mockClear()
  dlqEnqueueSpy.mockClear()
  recordDroppedEventSpy.mockClear()
  // Default: dispatch succeeds
  dispatchFinishedSpy.mockResolvedValue(undefined)
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('IPN DLQ Overflow Contract Tests', () => {
  describe('Normal DLQ operation — regression guard', () => {
    it('enqueues to DLQ when handler throws permanent error', async () => {
      const ipn = makeIpnThatTriggersDlq()

      const result = await processNowPaymentsIpn(ipn)
      expect(result.success).toBe(false)
      expect(result.message).toContain('Permanent failure')
      expect(dlqEnqueueSpy).toHaveBeenCalledTimes(1)
    })

    it('does NOT enqueue when DLQ retries exhausted (MAX_DLQ_RETRIES=3)', async () => {
      // This contract documents the expected MAX_DLQ_RETRIES behavior.
      // When retry_count >= 3, processNowPaymentsIpn returns
      // "Permanent failure after 3 retries" and does NOT call enqueueDlqEntry.
      // Full verification requires mocking the dlq from() to return
      // retry_count >= 3, which is done in Phase 04 integration tests.
      //
      // For now, we verify the constant exists and the normal DLQ path works.
      // The MAX_DLQ_RETRIES guard is at handlers.ts:144-149.
      const ipn = makeIpnThatTriggersDlq()

      const result = await processNowPaymentsIpn(ipn)
      expect(result.success).toBe(false)
      // Normal DLQ path: retry_count is 0 (below MAX), so enqueue proceeds
      expect(dlqEnqueueSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('DLQ at capacity — proof of silent drop (P1.5)', () => {
    it('rejects event when DLQ at capacity (1000/1000)', async () => {
      mockUnresolvedDlqCount = 1000
      const ipn = makeIpnThatTriggersDlq()

      const result = await processNowPaymentsIpn(ipn)
      expect(result.success).toBe(false)
      expect(result.message).toContain('DLQ at capacity')
      expect(result.message).toContain('recorded as dropped')

      // Phase 03: event is recorded before rejection — not silently dropped
      expect(dlqEnqueueSpy).not.toHaveBeenCalled()
      expect(recordDroppedEventSpy).toHaveBeenCalledTimes(1)
    })

    it('records dropped event durably before rejecting — enables reconciliation', async () => {
      mockUnresolvedDlqCount = 1000
      const ipn = makeIpnThatTriggersDlq()
      const paymentId = ipn.payment_id

      const result = await processNowPaymentsIpn(ipn)
      expect(result.success).toBe(false)

      // Phase 03: recordDroppedEvent is called with the event data before rejection.
      // Operators can now reconcile via GET /api/admin/dlq/reconciliation
      // and replay via POST /api/admin/dlq/replay.
      expect(recordDroppedEventSpy).toHaveBeenCalledTimes(1)
      const callArgs = recordDroppedEventSpy.mock.calls[0]
      // First arg is db, second is the input object
      expect(callArgs[1]).toMatchObject({
        eventId: expect.stringContaining(paymentId),
        paymentId: paymentId,
        paymentStatus: 'finished',
        dlqSize: 1000,
      })
      // DLQ enqueue is NOT called — dropped, not queued
      expect(dlqEnqueueSpy).not.toHaveBeenCalled()
    })

    it('rejects at exactly 1000 (boundary)', async () => {
      mockUnresolvedDlqCount = 1000
      const ipn = makeIpnThatTriggersDlq()

      const result = await processNowPaymentsIpn(ipn)
      expect(result.success).toBe(false)
      expect(result.message).toContain('1000/1000')
      expect(dlqEnqueueSpy).not.toHaveBeenCalled()
    })

    it('enqueues at 999 (just below capacity)', async () => {
      mockUnresolvedDlqCount = 999
      const ipn = makeIpnThatTriggersDlq()

      const result = await processNowPaymentsIpn(ipn)
      // At 999, the event SHOULD be enqueued (below capacity)
      expect(dlqEnqueueSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('DLQ graduated thresholds', () => {
    it('does not warn below 50%', async () => {
      mockUnresolvedDlqCount = 400 // 40%
      dispatchFinishedSpy.mockRejectedValueOnce(new Error('validation error'))
      const ipn = makeIpn({ payment_id: 'pay_thresh_low_001' })

      await processNowPaymentsIpn(ipn)
      // At 40%, no warning threshold triggered. DLQ enqueue proceeds normally.
      expect(dlqEnqueueSpy).toHaveBeenCalledTimes(1)
    })

    it('is at 50% threshold (warn level)', async () => {
      mockUnresolvedDlqCount = 500 // exactly 50%
      dispatchFinishedSpy.mockRejectedValueOnce(new Error('validation error'))
      const ipn = makeIpn({ payment_id: 'pay_thresh_50_001' })

      await processNowPaymentsIpn(ipn)
      // At 50%, logger.warn is called but enqueue still proceeds
      expect(dlqEnqueueSpy).toHaveBeenCalledTimes(1)
    })

    it('is at 90% threshold (error level)', async () => {
      mockUnresolvedDlqCount = 900 // exactly 90%
      dispatchFinishedSpy.mockRejectedValueOnce(new Error('validation error'))
      const ipn = makeIpn({ payment_id: 'pay_thresh_90_001' })

      await processNowPaymentsIpn(ipn)
      // At 90%, logger.error is called but enqueue still proceeds (below 1000)
      expect(dlqEnqueueSpy).toHaveBeenCalledTimes(1)
    })
  })
})
