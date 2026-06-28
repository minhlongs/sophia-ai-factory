/**
 * Unit tests for order-query.ts
 * Mocks getD1 to avoid live D1 dependency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUserOrders } from '../order-query'

// ── D1 mock ───────────────────────────────────────────────────────────────────

function makeD1Mock(rows: unknown[]) {
  const prepared = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockReturnValue({ results: rows, success: true }),
    first: vi.fn().mockReturnValue(null),
    run: vi.fn().mockReturnValue({ success: true }),
  }
  return {
    prepare: vi.fn().mockReturnValue(prepared),
    batch: vi.fn().mockReturnValue([]),
    exec: vi.fn().mockReturnValue({ count: 0, duration: 0 }),
  }
}

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}))

import { getD1 } from '@/seed/db/client'
const mockedGetD1 = vi.mocked(getD1)

describe('getUserOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array for user with no purchases', async () => {
    mockedGetD1.mockReturnValue(makeD1Mock([]) as unknown as D1Database)
    const result = await getUserOrders('user-123')
    expect(result).toEqual([])
  })

  it('maps a purchase row with no video to null videoStatus', async () => {
    mockedGetD1.mockReturnValue(makeD1Mock([
      {
        purchase_id: 'p-1',
        sku: 'starter-10',
        purchase_status: 'paid',
        paid_at: 1000000,
        credits_remaining: 10,
        video_id: null,
        video_status: null,
        attempt_count: null,
        last_attempt_at: null,
        video_url: null,
      },
    ]) as unknown as D1Database)

    const result = await getUserOrders('user-123')
    expect(result).toHaveLength(1)
    expect(result[0].purchaseId).toBe('p-1')
    expect(result[0].videoStatus).toBeNull()
    expect(result[0].videoId).toBeNull()
    expect(result[0].attemptCount).toBe(0)
    expect(result[0].estimatedReadyAt).toBe(1000000 + 8 * 60)
  })

  it('maps a purchase row with queued video correctly', async () => {
    mockedGetD1.mockReturnValue(makeD1Mock([
      {
        purchase_id: 'p-2',
        sku: 'growth-20',
        purchase_status: 'paid',
        paid_at: 2000000,
        credits_remaining: 20,
        video_id: 'v-abc',
        video_status: 'queued',
        attempt_count: 2,
        last_attempt_at: 2000100,
        video_url: null,
      },
    ]) as unknown as D1Database)

    const result = await getUserOrders('user-abc')
    expect(result[0].videoStatus).toBe('queued')
    expect(result[0].videoId).toBe('v-abc')
    expect(result[0].attemptCount).toBe(2)
  })

  it('returns empty array and logs on DB error', async () => {
    mockedGetD1.mockRejectedValue(new Error('D1 unavailable'))
    const result = await getUserOrders('user-xyz')
    expect(result).toEqual([])
  })
})
