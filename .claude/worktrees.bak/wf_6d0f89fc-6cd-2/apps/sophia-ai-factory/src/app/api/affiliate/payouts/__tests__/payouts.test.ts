/**
 * /api/affiliate/payouts — auth + cents→USD conversion + tenant scoping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}))

import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getD1 } from '@/seed/db/client'
import { GET } from '../route'

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/affiliate/payouts')
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

function mockD1Returning(rows: unknown[]) {
  const prepared = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: rows, success: true }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true }),
  }
  return {
    prepare: vi.fn().mockReturnValue(prepared),
    batch: vi.fn(),
    exec: vi.fn(),
  }
}

describe('GET /api/affiliate/payouts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const resp = await GET(buildRequest())
    expect(resp.status).toBe(401)
  })

  it('converts total_cents → total_usd in response', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>)
    vi.mocked(getD1).mockReturnValue(mockD1Returning([
      {
        id: 'b1',
        total_cents: 2550, // $25.50
        ledger_count: 3,
        status: 'confirmed',
        payment_method: 'usdt_trc20',
        network: 'TRC20',
        external_payment_id: 'np_123',
        created_at: 1700000000,
        finalized_at: 1700001000,
      },
    ]) as unknown as D1Database)

    const resp = await GET(buildRequest())
    expect(resp.status).toBe(200)
    const body = (await resp.json()) as {
      affiliateId: string
      batches: { id: string; total_cents: number; total_usd: number; payment_method: string }[]
    }
    expect(body.affiliateId).toBe('u1')
    expect(body.batches).toHaveLength(1)
    expect(body.batches[0].total_cents).toBe(2550)
    expect(body.batches[0].total_usd).toBe(25.5)
    expect(body.batches[0].payment_method).toBe('usdt_trc20')
  })

  it('caps limit at 100', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>)
    const d1 = mockD1Returning([])
    vi.mocked(getD1).mockReturnValue(d1 as unknown as D1Database)
    await GET(buildRequest({ limit: '999' }))
    const prepared = d1.prepare.mock.results[0].value
    // Third bind arg is limit
    expect(prepared.bind).toHaveBeenCalledWith('u1', 'u1', 100)
  })

  it('returns empty list cleanly', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>)
    vi.mocked(getD1).mockReturnValue(mockD1Returning([]) as unknown as D1Database)
    const resp = await GET(buildRequest())
    const body = (await resp.json()) as { batches: unknown[] }
    expect(body.batches).toEqual([])
  })

  it('handles stripe_connect payment_method rows', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>)
    vi.mocked(getD1).mockReturnValue(mockD1Returning([
      {
        id: 'b2',
        total_cents: 10000,
        ledger_count: 5,
        status: 'confirmed',
        payment_method: 'stripe_connect',
        network: 'STRIPE',
        external_payment_id: 'tr_abc',
        created_at: 1700100000,
        finalized_at: null,
      },
    ]) as unknown as D1Database)

    const resp = await GET(buildRequest())
    const body = (await resp.json()) as {
      batches: { payment_method: string; total_usd: number; finalized_at: number | null }[]
    }
    expect(body.batches[0].payment_method).toBe('stripe_connect')
    expect(body.batches[0].total_usd).toBe(100)
    expect(body.batches[0].finalized_at).toBeNull()
  })
})
