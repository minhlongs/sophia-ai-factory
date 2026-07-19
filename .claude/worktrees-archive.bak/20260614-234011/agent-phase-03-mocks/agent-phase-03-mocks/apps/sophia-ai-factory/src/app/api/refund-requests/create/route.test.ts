/**
 * POST /api/refund-requests/create — 30-day window enforcement (P29).
 *
 * Focused tests for the new refund-window guard. Validates 422 outside window,
 * 201 inside, and fallback to created_at when paid_at is null.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}))

const dbFirst = vi.fn()
vi.mock('@/seed/db/client', () => ({
  getD1Raw: async () => ({
    prepare: () => ({
      bind: () => ({
        first: dbFirst,
      }),
    }),
  }),
}))

vi.mock('@/land/refunds/refund-repo', () => ({
  createRefundRequest: vi.fn().mockResolvedValue('refund-123'),
  getRefundByPurchaseAndUser: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/land/billing/email/send-refund-emails', () => ({
  sendRefundReceivedEmail: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from './route'
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session'

const mockUser = getCurrentUserFromHeaders as ReturnType<typeof vi.fn>

const SECONDS_PER_DAY = 86_400

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/refund-requests/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  purchaseId: 'p-1',
  reason: 'Did not work for my use case at all.',
  customerWalletAddress: '0xabcdef1234567890abcdef',
}

describe('POST /api/refund-requests/create — 30-day window', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser.mockResolvedValue({ id: 'u-1', email: 'a@b.com' })
  })

  it('accepts refund request inside 30-day window (paid_at recent)', async () => {
    const tenDaysAgo = Math.floor(Date.now() / 1000) - 10 * SECONDS_PER_DAY
    dbFirst.mockResolvedValueOnce({
      id: 'p-1',
      user_id: 'u-1',
      payment_id: 'pay-1',
      amount_cents: 19900,
      status: 'paid',
      created_at: tenDaysAgo - SECONDS_PER_DAY,
      paid_at: tenDaysAgo,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
  })

  it('rejects refund request past 30-day window with 422', async () => {
    const fortyDaysAgo = Math.floor(Date.now() / 1000) - 40 * SECONDS_PER_DAY
    dbFirst.mockResolvedValueOnce({
      id: 'p-old',
      user_id: 'u-1',
      payment_id: 'pay-old',
      amount_cents: 19900,
      status: 'paid',
      created_at: fortyDaysAgo,
      paid_at: fortyDaysAgo,
    })

    const res = await POST(makeRequest({ ...validBody, purchaseId: 'p-old' }))
    expect(res.status).toBe(422)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.error).toBe('refund_window_expired')
    expect(json.windowDays).toBe(30)
    expect(json.daysSincePurchase).toBeGreaterThanOrEqual(40)
  })

  it('falls back to created_at when paid_at is null', async () => {
    const fiveDaysAgo = Math.floor(Date.now() / 1000) - 5 * SECONDS_PER_DAY
    dbFirst.mockResolvedValueOnce({
      id: 'p-pending',
      user_id: 'u-1',
      payment_id: 'pay-pending',
      amount_cents: 19900,
      status: 'pending',
      created_at: fiveDaysAgo,
      paid_at: null,
    })

    const res = await POST(makeRequest({ ...validBody, purchaseId: 'p-pending' }))
    expect(res.status).toBe(201)
  })

  it('rejects at exact 30-day + 1 sec boundary (just past window)', async () => {
    const justPast = Math.floor(Date.now() / 1000) - (30 * SECONDS_PER_DAY + 1)
    dbFirst.mockResolvedValueOnce({
      id: 'p-edge',
      user_id: 'u-1',
      payment_id: 'pay-edge',
      amount_cents: 19900,
      status: 'paid',
      created_at: justPast,
      paid_at: justPast,
    })

    const res = await POST(makeRequest({ ...validBody, purchaseId: 'p-edge' }))
    expect(res.status).toBe(422)
  })

  it('returns 401 when unauthenticated', async () => {
    mockUser.mockResolvedValue(null)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })
})
