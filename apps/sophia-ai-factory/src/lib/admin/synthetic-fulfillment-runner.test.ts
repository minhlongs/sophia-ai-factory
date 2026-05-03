/**
 * Unit tests for synthetic-fulfillment-runner.
 *
 * Mocks: DB (insertPurchase, markPaid, findByPurchaseId, getD1Raw),
 *        triggerOneTimeFulfillment, billing_events check.
 *
 * Covers: happy path, timeout, fulfillment error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/seed/db/repositories/user-purchases-repo', () => ({
  insertPurchase: vi.fn(),
  markPaid: vi.fn(),
}))

vi.mock('@/seed/db/repositories/videos-repo', () => ({
  findByPurchaseId: vi.fn(),
}))

vi.mock('@/lib/fulfillment/one-time-fulfillment', () => ({
  triggerOneTimeFulfillment: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockD1First = vi.fn()
const mockD1PrepBind = vi.fn(() => ({ first: mockD1First }))
const mockD1Prep = vi.fn(() => ({ bind: mockD1PrepBind }))
const mockD1: D1Database = { prepare: mockD1Prep } as unknown as D1Database

vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(async () => mockD1),
}))

import { insertPurchase, markPaid } from '@/seed/db/repositories/user-purchases-repo'
import { findByPurchaseId } from '@/seed/db/repositories/videos-repo'
import { triggerOneTimeFulfillment } from '@/lib/fulfillment/one-time-fulfillment'
import { runSyntheticFulfillment } from './synthetic-fulfillment-runner'

const mockInsertPurchase = vi.mocked(insertPurchase)
const mockMarkPaid = vi.mocked(markPaid)
const mockFindByPurchaseId = vi.mocked(findByPurchaseId)
const mockTrigger = vi.mocked(triggerOneTimeFulfillment)

describe('runSyntheticFulfillment', () => {
  const userId = 'admin-user-id'

  beforeEach(() => {
    vi.clearAllMocks()
    mockMarkPaid.mockResolvedValue(undefined)
    // Default: no billing event
    mockD1First.mockResolvedValue(null)
  })

  it('returns failed outcome when unknown SKU provided', async () => {
    const result = await runSyntheticFulfillment(userId, 'NONEXISTENT' as 'STARTER_BUNDLE')
    expect(result.outcome).toBe('failed')
    expect(result.errors).toContain('Unknown SKU: NONEXISTENT')
    expect(result.purchase_id).toBeNull()
  })

  it('returns failed when insertPurchase returns null', async () => {
    mockInsertPurchase.mockResolvedValue(null)
    const result = await runSyntheticFulfillment(userId, 'STARTER_BUNDLE', 5000)
    expect(result.outcome).toBe('failed')
    expect(result.errors[0]).toMatch(/insertPurchase returned null/)
  })

  it('happy path — completes immediately after queued (mocked)', async () => {
    mockInsertPurchase.mockResolvedValue('purchase-123')
    mockTrigger.mockResolvedValue(undefined)

    // findByPurchaseId: first call returns 'queued', subsequent polling returns 'completed'
    mockFindByPurchaseId.mockResolvedValueOnce({
      id: 'video-abc',
      status: 'queued',
      purchase_id: 'purchase-123',
    } as ReturnType<typeof mockFindByPurchaseId> extends Promise<infer T> ? T : never)

    // Poll: D1 prepare returns 'completed' on first poll
    mockD1First.mockResolvedValueOnce({ id: 'video-abc', status: 'completed' })

    const result = await runSyntheticFulfillment(userId, 'STARTER_BUNDLE', 30_000)

    expect(result.payment_id).toMatch(/^ADMIN_SYNTHETIC_/)
    expect(result.purchase_id).toBe('purchase-123')
    expect(result.video_id).toBe('video-abc')
    expect(result.outcome).toBe('completed')
    expect(result.timeline.paid_at).toBeGreaterThan(0)
    expect(result.timeline.queued_at).not.toBeNull()
    expect(result.timeline.completed_at).not.toBeNull()
    expect(result.deltas_ms.total).not.toBeNull()
    expect(result.errors).toHaveLength(0)
  })

  it('timeout outcome when video never completes', async () => {
    mockInsertPurchase.mockResolvedValue('purchase-456')
    mockTrigger.mockResolvedValue(undefined)

    mockFindByPurchaseId.mockResolvedValue({
      id: 'video-xyz',
      status: 'queued',
      purchase_id: 'purchase-456',
    } as ReturnType<typeof mockFindByPurchaseId> extends Promise<infer T> ? T : never)

    // Polling always returns 'processing' (never completes)
    mockD1First.mockResolvedValue({ id: 'video-xyz', status: 'processing' })

    // Short timeout to speed up the test
    const result = await runSyntheticFulfillment(userId, 'STARTER_BUNDLE', 100)

    expect(result.outcome).toBe('timeout')
    expect(result.video_id).toBe('video-xyz')
    expect(result.timeline.processing_at).not.toBeNull()
    expect(result.timeline.completed_at).toBeNull()
  }, 15_000)

  it('records error when triggerOneTimeFulfillment throws but still tries to poll', async () => {
    mockInsertPurchase.mockResolvedValue('purchase-789')
    mockTrigger.mockRejectedValue(new Error('HeyGen unavailable'))

    // No video row (fulfillment failed before enqueue)
    mockFindByPurchaseId.mockResolvedValue(null)

    const result = await runSyntheticFulfillment(userId, 'STARTER_BUNDLE', 5000)

    expect(result.outcome).toBe('failed')
    expect(result.errors.some((e) => e.includes('HeyGen unavailable'))).toBe(true)
    expect(result.errors.some((e) => e.includes('No videos row'))).toBe(true)
  })
})
