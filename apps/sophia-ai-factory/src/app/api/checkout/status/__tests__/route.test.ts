/**
 * GET /api/checkout/status tests.
 * Verifies 200/400/404 responses.
 */

import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockOrders: Record<string, { order_id: string; status: string; tier: string; period: string; payment_id: string | null; completed_at: string | null }> = {
  'sophia_user123_1700000000000': {
    order_id: 'sophia_user123_1700000000000',
    status: 'completed',
    tier: 'PREMIUM',
    period: 'monthly',
    payment_id: 'pay_abc123',
    completed_at: '2026-05-03T10:00:00Z',
  },
}

vi.mock('@/lib/orders/pending-order-repo', () => ({
  getOrderById: vi.fn(async (orderId: string) => mockOrders[orderId] ?? null),
}))

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

import { GET } from '../route'

function makeRequest(orderId: string | null) {
  const url = orderId
    ? `http://localhost/api/checkout/status?orderId=${encodeURIComponent(orderId)}`
    : 'http://localhost/api/checkout/status'
  return new NextRequest(url)
}

describe('GET /api/checkout/status', () => {
  it('returns 200 with order data for valid orderId', async () => {
    const req = makeRequest('sophia_user123_1700000000000')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; tier: string }
    expect(body.status).toBe('completed')
    expect(body.tier).toBe('PREMIUM')
  })

  it('returns 404 for unknown orderId', async () => {
    const req = makeRequest('sophia_unknown_9999999999999')
    const res = await GET(req)
    expect(res.status).toBe(404)
  })

  it('returns 400 for malformed orderId (missing sophia_ prefix)', async () => {
    const req = makeRequest('invalid-order-id')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when orderId is missing', async () => {
    const req = makeRequest(null)
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
