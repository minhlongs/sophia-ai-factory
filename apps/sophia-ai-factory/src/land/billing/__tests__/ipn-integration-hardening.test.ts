/**
 * Integration tests: NOWPayments IPN pipeline hardening.
 *
 * Validates:
 *   Group A — Concurrency robustness (Phase 02 TOCTOU fix validation)
 *   Group B — DLQ overflow end-to-end (Phase 03 DLQ hardening validation)
 *   Group C — Full IPN lifecycle regression
 *
 * These tests verify that Phase 02 and Phase 03 fixes work correctly
 * in combination, from webhook entry through to handler dispatch.
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { processNowPaymentsIpn } from '../nowpayments-ipn-handlers'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const dispatchFinishedSpy = vi.fn()
const dispatchRefundedSpy = vi.fn()
const recordDroppedEventSpy = vi.fn()
const dlqEnqueueSpy = vi.fn()

let mockUnresolvedDlqCount = 0

vi.mock('../nowpayments-ipn-dispatch', () => ({
  dispatchFinished: (ipn: Record<string, unknown>) => dispatchFinishedSpy(ipn),
  dispatchRefunded: (ipn: Record<string, unknown>) => dispatchRefundedSpy(ipn),
}))

vi.mock('../nowpayments-ipn-subscription', () => ({
  handleFailed: vi.fn().mockResolvedValue({ ok: true }),
}))

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

// ── D1 mock ────────────────────────────────────────────────────────────────────

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
  order_id: string
  invoice_id: string
  price_amount: number
  price_currency: string
}> = {}) {
  return {
    payment_id: overrides.payment_id ?? `pay_int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    payment_status: (overrides.payment_status ?? 'finished') as 'finished',
    price_amount: overrides.price_amount ?? 199,
    price_currency: overrides.price_currency ?? 'USD',
    order_id: overrides.order_id ?? `sophia_user123_${Date.now()}`,
    invoice_id: overrides.invoice_id ?? 'inv_test_001',
  }
}

beforeEach(() => {
  mockDbEvents.clear()
  mockUnresolvedDlqCount = 0
  dispatchFinishedSpy.mockClear()
  dispatchRefundedSpy.mockClear()
  recordDroppedEventSpy.mockClear()
  dlqEnqueueSpy.mockClear()
  dispatchFinishedSpy.mockResolvedValue(undefined)
  dispatchRefundedSpy.mockResolvedValue(undefined)
})

// ── Test Groups ────────────────────────────────────────────────────────────────

describe('IPN Integration Hardening', () => {
  // ── Group A: Concurrency Robustness (Phase 02 validation) ────────────────────

  describe('Group A — Concurrency robustness', () => {
    it('handles 5 concurrent finished IPNs for different payment_ids (same user+tier)', async () => {
      const ipns = Array.from({ length: 5 }, (_, i) =>
        makeIpn({
          payment_id: `pay_conc_a_${i}`,
          payment_status: 'finished',
          order_id: `sophia_user123_${1700000000000 + i}`,
        }),
      )

      const results = await Promise.all(ipns.map((ipn) => processNowPaymentsIpn(ipn)))

      // All 5 process successfully — different payment_ids, different event_ids
      expect(results.every((r) => r.success)).toBe(true)
      expect(dispatchFinishedSpy).toHaveBeenCalledTimes(5)
    })

    it('handles 3 concurrent refunds for same payment_id — exactly one processes', async () => {
      const paymentId = 'pay_conc_b_refund'
      const ipn = makeIpn({ payment_id: paymentId, payment_status: 'refunded' })

      // Send 3 concurrent refund IPNs for the same payment_id
      const results = await Promise.all([
        processNowPaymentsIpn({ ...ipn }),
        processNowPaymentsIpn({ ...ipn }),
        processNowPaymentsIpn({ ...ipn }),
      ])

      // Exactly one processes — atomic lock blocks the other two.
      // The other two may get "Already processed" (if first finished marking)
      // or "Already processing" (if first still in progress). Both are valid
      // idempotent responses that prevent double-processing.
      const processed = results.filter((r) => r.message === 'Processed refunded')
      const idempotent = results.filter((r) =>
        r.message === 'Already processed' || r.message === 'Already processing',
      )
      expect(processed).toHaveLength(1)
      expect(idempotent).toHaveLength(2)
      expect(dispatchRefundedSpy).toHaveBeenCalledTimes(1)
    })

    it('handles concurrent finished + refunded for different payment_ids', async () => {
      const finished = makeIpn({ payment_id: 'pay_conc_c_fin', payment_status: 'finished' })
      const refunded = makeIpn({ payment_id: 'pay_conc_c_ref', payment_status: 'refunded' })

      const [r1, r2] = await Promise.all([
        processNowPaymentsIpn(finished),
        processNowPaymentsIpn(refunded),
      ])

      // Both process — different payment_ids, no conflict
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
      expect(dispatchFinishedSpy).toHaveBeenCalledTimes(1)
      expect(dispatchRefundedSpy).toHaveBeenCalledTimes(1)
    })

    it('handles concurrent finished + failed for same user', async () => {
      const finished = makeIpn({ payment_id: 'pay_conc_d_fin', payment_status: 'finished' })
      const failed = makeIpn({ payment_id: 'pay_conc_d_fail', payment_status: 'failed' })

      const [r1, r2] = await Promise.all([
        processNowPaymentsIpn(finished),
        processNowPaymentsIpn(failed),
      ])

      // Both process — different event_ids, no conflict
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
      expect(dispatchFinishedSpy).toHaveBeenCalledTimes(1)
    })
  })

  // ── Group B: DLQ Overflow End-to-End (Phase 03 validation) ────────────────────

  describe('Group B — DLQ overflow end-to-end', () => {
    beforeEach(() => {
      dispatchFinishedSpy.mockRejectedValue(new Error('validation: invalid tier config'))
    })

    it('records dropped event when DLQ at capacity', async () => {
      mockUnresolvedDlqCount = 1000
      const ipn = makeIpn({ payment_id: 'pay_dlq_e2e_001' })

      const result = await processNowPaymentsIpn(ipn)
      expect(result.success).toBe(false)
      expect(result.message).toContain('recorded as dropped')

      // Event IS recorded (not silently lost)
      expect(recordDroppedEventSpy).toHaveBeenCalledTimes(1)
      // DLQ enqueue is NOT called (at capacity)
      expect(dlqEnqueueSpy).not.toHaveBeenCalled()
    })

    it('enqueues when DLQ is below capacity (regression guard)', async () => {
      mockUnresolvedDlqCount = 500 // 50%
      const ipn = makeIpn({ payment_id: 'pay_dlq_e2e_002' })

      const result = await processNowPaymentsIpn(ipn)
      expect(result.success).toBe(false)
      expect(dlqEnqueueSpy).toHaveBeenCalledTimes(1)
      expect(recordDroppedEventSpy).not.toHaveBeenCalled()
    })

    it('records dropped event with correct metadata', async () => {
      mockUnresolvedDlqCount = 1000
      const ipn = makeIpn({ payment_id: 'pay_dlq_e2e_003' })

      await processNowPaymentsIpn(ipn)

      expect(recordDroppedEventSpy).toHaveBeenCalledTimes(1)
      const callInput = recordDroppedEventSpy.mock.calls[0][1]
      expect(callInput).toMatchObject({
        paymentId: 'pay_dlq_e2e_003',
        paymentStatus: 'finished',
        dlqSize: 1000,
      })
    })
  })

  // ── Group C: Full Lifecycle (Regression) ──────────────────────────────────────

  describe('Group C — Full IPN lifecycle', () => {
    it('finished → activates subscription (happy path)', async () => {
      const ipn = makeIpn({ payment_id: 'pay_life_happy', payment_status: 'finished' })

      const result = await processNowPaymentsIpn(ipn)
      expect(result.success).toBe(true)
      expect(result.message).toBe('Processed finished')
      expect(dispatchFinishedSpy).toHaveBeenCalledTimes(1)
    })

    it('finished → refunded lifecycle (different event_ids, both process)', async () => {
      const finished = makeIpn({ payment_id: 'pay_life_cycle', payment_status: 'finished' })
      const refunded = makeIpn({ payment_id: 'pay_life_cycle', payment_status: 'refunded' })

      const r1 = await processNowPaymentsIpn(finished)
      expect(r1.success).toBe(true)
      expect(r1.message).toBe('Processed finished')

      const r2 = await processNowPaymentsIpn(refunded)
      expect(r2.success).toBe(true)
      expect(r2.message).toBe('Processed refunded')

      expect(dispatchFinishedSpy).toHaveBeenCalledTimes(1)
      expect(dispatchRefundedSpy).toHaveBeenCalledTimes(1)
    })

    it('duplicate finished → idempotent (no double activation)', async () => {
      const ipn = makeIpn({ payment_id: 'pay_life_dup', payment_status: 'finished' })

      // First call processes
      const r1 = await processNowPaymentsIpn(ipn)
      expect(r1.success).toBe(true)
      expect(r1.message).toBe('Processed finished')
      expect(dispatchFinishedSpy).toHaveBeenCalledTimes(1)

      // Second call is idempotent — atomic lock blocks it
      dispatchFinishedSpy.mockClear()
      const r2 = await processNowPaymentsIpn(ipn)
      expect(r2.success).toBe(true)
      expect(r2.message).toBe('Already processed')
      expect(dispatchFinishedSpy).not.toHaveBeenCalled()
    })
  })
})
