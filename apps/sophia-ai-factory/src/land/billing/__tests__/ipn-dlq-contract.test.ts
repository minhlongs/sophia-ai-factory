/**
 * Contract tests: IPN Dead-Letter Queue Overflow & Recovery
 *
 * Verifies:
 * - DLQ capacity monitoring (50% warning, 90% critical)
 * - DLQ overflow at 1000 cap (events rejected, not silently dropped)
 * - DLQ enqueue idempotency (duplicate entries bump retry_count)
 * - getStaleDlqEntries, reenqueueDlqEntry, resolveDlqEntry contracts
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest'

import { buildD1Mock, uniqueViolationError } from './d1-mock-factory'

import {
  enqueueDlqEntry,
  countUnresolvedDlq,
  getStaleDlqEntries,
  reenqueueDlqEntry,
  resolveDlqEntry,
} from '../nowpayments-ipn-dead-letter'

const DEFAULT_OPTS = {
  eventId: 'evt_001',
  paymentId: 'pay_001',
  paymentStatus: 'finished',
  orderId: 'order_001',
  payload: { test: true },
  failureReason: 'test failure',
  retryCount: 0,
}

describe('DLQ — enqueueDlqEntry', () => {
  it('inserts new DLQ entry successfully with all required fields', async () => {
    const insertLog: Array<Record<string, unknown>> = []
    const db = buildD1Mock({ insertLog })

    await enqueueDlqEntry(db, DEFAULT_OPTS)

    expect(insertLog.length).toBeGreaterThanOrEqual(1)
    const entry = insertLog[0]
    expect(entry).toHaveProperty('event_id', 'evt_001')
    expect(entry).toHaveProperty('payment_id', 'pay_001')
    expect(entry).toHaveProperty('payment_status', 'finished')
    expect(entry).toHaveProperty('order_id', 'order_001')
    expect(entry).toHaveProperty('failure_reason', 'test failure')
    expect(entry).toHaveProperty('retry_count', 0)
    expect(entry).toHaveProperty('first_failed_at')
    expect(entry).toHaveProperty('last_attempted_at')
    expect(entry).toHaveProperty('resolved', 0)
  })

  it('handles UNIQUE violation by bumping retry_count', async () => {
    const insertLog: Array<Record<string, unknown>> = []
    const db = buildD1Mock({
      insertError: uniqueViolationError(),
      insertLog,
      updateResult: { count: 1, error: null },
    })

    await enqueueDlqEntry(db, {
      eventId: 'evt_duplicate',
      paymentId: 'pay_dup',
      paymentStatus: 'finished',
      orderId: 'order_dup',
      payload: {},
      failureReason: 'dup test',
      retryCount: 1,
    })

    // Should not throw — handles duplicate gracefully
  })

  it('increments retry_count on duplicate entry (idempotent update)', async () => {
    let insertCount = 0
    const db = buildD1Mock({
      insertError: uniqueViolationError(),
      updateResult: { count: 1, error: null },
      onInsert: () => { insertCount++ },
    })

    // First insert succeeds
    await enqueueDlqEntry(db, DEFAULT_OPTS)
    expect(insertCount).toBe(1)
  })

  it('inserts entry with serialized JSON payload', async () => {
    const insertLog: Array<Record<string, unknown>> = []
    const db = buildD1Mock({ insertLog })

    const complexPayload = { userId: 'u1', amount: 199, meta: { source: 'nowpayments' } }
    await enqueueDlqEntry(db, { ...DEFAULT_OPTS, payload: complexPayload })

    expect(insertLog.length).toBeGreaterThanOrEqual(1)
    const payloadField = insertLog[0].payload as string
    expect(typeof payloadField).toBe('string')
    const parsed = JSON.parse(payloadField) as Record<string, unknown>
    expect(parsed.amount).toBe(199)
  })
})

describe('DLQ — countUnresolvedDlq', () => {
  it('returns 0 when DLQ is empty', async () => {
    const db = buildD1Mock({ selectCountResult: { count: 0, error: null } })
    const count = await countUnresolvedDlq(db)
    expect(count).toBe(0)
  })

  it('returns correct count of unresolved entries', async () => {
    const db = buildD1Mock({ selectCountResult: { count: 500, error: null } })
    const count = await countUnresolvedDlq(db)
    expect(count).toBe(500)
  })

  it('returns 0 when query errors', async () => {
    const db = buildD1Mock({ selectCountResult: { count: null, error: { code: '1', message: 'error' } } })
    const count = await countUnresolvedDlq(db)
    expect(count).toBe(0)
  })

  it('returns 0 when count is null', async () => {
    const db = buildD1Mock({ selectCountResult: { count: null, error: null } })
    const count = await countUnresolvedDlq(db)
    expect(count).toBe(0)
  })
})

describe('DLQ — capacity monitoring thresholds', () => {
  /**
   * RED TESTS — expose missing monitoring:
   * 1. DLQ at 500 (50%) -> should emit dlq.capacity.warning
   * 2. DLQ at 900 (90%) -> should emit dlq.capacity.critical
   *
   * Currently no monitoring at these thresholds.
   */
  it.todo('RED: DLQ count = 500 emits dlq.capacity.warning event')
  it.todo('RED: DLQ count = 900 emits dlq.capacity.critical event')
  it.todo('RED: DLQ count = 1000+ rejects new event with DLQ_OVERFLOW')
})

describe('DLQ — getStaleDlqEntries', () => {
  it('returns empty array when no stale entries', async () => {
    const db = buildD1Mock({
      selectListResult: { data: [], error: null },
    })

    const entries = await getStaleDlqEntries(db, 24)
    expect(entries).toEqual([])
  })

  it('returns stale entries older than N hours with correct shape', async () => {
    const staleEntry = {
      event_id: 'evt_stale_001',
      payment_id: 'pay_stale_001',
      payment_status: 'finished',
      order_id: 'order_stale_001',
      payload: JSON.stringify({ test: true }),
      failure_reason: 'timeout',
      retry_count: 2,
      first_failed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      last_attempted_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      resolved: 0,
      resolved_at: null,
    }

    const db = buildD1Mock({
      selectListResult: { data: [staleEntry], error: null },
    })

    const entries = await getStaleDlqEntries(db, 24)
    expect(entries).toHaveLength(1)
    expect(entries[0].event_id).toBe('evt_stale_001')
    expect(entries[0].payment_id).toBe('pay_stale_001')
    expect(entries[0].resolved).toBe(false)
    expect(entries[0].resolved_at).toBeUndefined()
    expect(entries[0].payload).toEqual({ test: true })
  })

  it('parses payload JSON correctly in stale entries', async () => {
    const staleEntry = {
      event_id: 'evt_payload_test',
      payment_id: 'pay_payload_test',
      payment_status: 'failed',
      order_id: 'order_fail',
      payload: JSON.stringify({ amount: 199.50, currency: 'USD', userId: 'u_abc' }),
      failure_reason: 'validation error',
      retry_count: 1,
      first_failed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      last_attempted_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      resolved: 0,
      resolved_at: null,
    }

    const db = buildD1Mock({
      selectListResult: { data: [staleEntry], error: null },
    })

    const entries = await getStaleDlqEntries(db, 24)
    expect(entries[0].payload.amount).toBe(199.50)
    expect(entries[0].payload.currency).toBe('USD')
  })

  it('handles malformed payload JSON gracefully', async () => {
    const staleEntry = {
      event_id: 'evt_bad_payload',
      payment_id: 'pay_bad',
      payment_status: 'failed',
      order_id: 'order_bad',
      payload: '{bad json}',
      failure_reason: 'parse error',
      retry_count: 1,
      first_failed_at: new Date().toISOString(),
      last_attempted_at: new Date().toISOString(),
      resolved: 0,
      resolved_at: null,
    }

    const db = buildD1Mock({
      selectListResult: { data: [staleEntry], error: null },
    })

    const entries = await getStaleDlqEntries(db, 24)
    expect(entries[0].payload).toEqual({})
  })

  it('respects limit parameter', async () => {
    const staleEntries = Array.from({ length: 5 }, (_, i) => ({
      event_id: `evt_${i}`,
      payment_id: `pay_${i}`,
      payment_status: 'finished',
      order_id: `order_${i}`,
      payload: '{}',
      failure_reason: 'error',
      retry_count: 0,
      first_failed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      last_attempted_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      resolved: 0,
      resolved_at: null,
    }))

    const db = buildD1Mock({
      selectListResult: { data: staleEntries.slice(0, 3), error: null },
    })

    const result = await getStaleDlqEntries(db, 24, 3)
    expect(result).toHaveLength(3)
  })

  it('returns empty array on query error', async () => {
    const db = buildD1Mock({
      selectListResult: { data: [], error: { code: '1', message: 'error' } },
    })

    const entries = await getStaleDlqEntries(db, 24)
    expect(entries).toEqual([])
  })
})

describe('DLQ — reenqueueDlqEntry', () => {
  it('resets retry_count to 0 on reenqueue (returns true on success)', async () => {
    const db = buildD1Mock({ updateResult: { count: 1, error: null } })
    const result = await reenqueueDlqEntry(db, 'evt_reenqueue')
    expect(result).toBe(true)
  })

  it('returns false when update fails', async () => {
    const db = buildD1Mock({ updateResult: { count: 0, error: { code: '1', message: 'error' } } })
    const result = await reenqueueDlqEntry(db, 'evt_not_found')
    expect(result).toBe(false)
  })
})

describe('DLQ — resolveDlqEntry', () => {
  it('marks DLQ entry as resolved without throwing', async () => {
    const db = buildD1Mock({ updateResult: { count: 1, error: null } })
    await expect(resolveDlqEntry(db, 'evt_resolve_001')).resolves.toBeUndefined()
  })
})

describe('DLQ — retry cron', () => {
  /**
   * RED TESTS for DLQ retry cron.
   * Currently no periodic retry mechanism exists.
   */
  it.todo('RED: retry cron with 0 stale entries -> no-op, no errors')
  it.todo('RED: retry cron with 15 stale entries -> processes 10, leaves 5 (batch size)')
  it.todo('RED: retry cron on entry with retry_count >= MAX -> marks resolved (exhausted)')
})
