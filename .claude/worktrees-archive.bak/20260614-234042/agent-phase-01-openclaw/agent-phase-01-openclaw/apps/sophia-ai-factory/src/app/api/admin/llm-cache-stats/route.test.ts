/**
 * Tests for GET /api/admin/llm-cache-stats — Phase 4H.
 *
 * Covers: CRON_SECRET auth / D1 unavailable / happy path / getCacheStats throws.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/tree/admin/monitoring-queries', () => ({
  getCacheStats: vi.fn(),
  cacheHitRate:  vi.fn(),
}))

import { getCacheStats, cacheHitRate } from '@/tree/admin/monitoring-queries'
import { GET } from './route'

const mockGetCacheStats = vi.mocked(getCacheStats)
const mockCacheHitRate  = vi.mocked(cacheHitRate)

function buildRequest(auth?: string): NextRequest {
  const headers = new Headers(auth ? { authorization: auth } : {})
  return { headers } as unknown as NextRequest
}

const SAMPLE_STATS = {
  total:       100,
  fresh:        80,
  expired:      20,
  totalHits:   250,
  tokensSaved: 5000,
}

describe('GET /api/admin/llm-cache-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'test-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 when CRON_SECRET header missing in production', async () => {
    const res = await GET(buildRequest())
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Unauthorized')
  })

  it('returns {ok:true, stats, hitRate} on happy path', async () => {
    mockGetCacheStats.mockResolvedValue({ ok: true, data: SAMPLE_STATS })
    mockCacheHitRate.mockReturnValue(0.71)

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean; ts: string; stats: typeof SAMPLE_STATS; hitRate: number
    }
    expect(body.ok).toBe(true)
    expect(body.stats).toEqual(SAMPLE_STATS)
    expect(body.hitRate).toBe(0.71)
    expect(typeof body.ts).toBe('string')
  })

  it('returns {ok:false, reason:"D1_UNAVAILABLE"} when getCacheStats returns ok:false', async () => {
    mockGetCacheStats.mockResolvedValue({
      ok: false,
      data: { total: 0, fresh: 0, expired: 0, totalHits: 0, tokensSaved: 0 },
    })

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; reason: string; ts: string }
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('D1_UNAVAILABLE')
    expect(typeof body.ts).toBe('string')
  })

  it('returns {ok:false, reason:"D1_ERROR", error:msg} when getCacheStats throws', async () => {
    mockGetCacheStats.mockRejectedValue(new Error('connection timeout'))

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; reason: string; error: string; ts: string }
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('D1_ERROR')
    expect(body.error).toBe('connection timeout')
    expect(typeof body.ts).toBe('string')
  })
})
