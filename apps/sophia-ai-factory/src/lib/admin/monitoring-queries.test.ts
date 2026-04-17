import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCacheStats,
  getWorkflowStats,
  getSignalsStats,
  cacheHitRate,
} from './monitoring-queries'
import { createServerClient } from '@/lib/db/client'

vi.mock('@/lib/db/client', () => ({
  createServerClient: vi.fn(),
}))

function mockRpc(returnValue: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(returnValue)
  vi.mocked(createServerClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createServerClient>)
  return rpc
}

describe('monitoring-queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCacheStats', () => {
    it('maps snake_case RPC row to camelCase fields with ok=true', async () => {
      mockRpc({
        data: { total: 5, fresh: 3, expired: 2, total_hits: 11, tokens_saved: 2048 },
        error: null,
      })
      const res = await getCacheStats()
      expect(res.ok).toBe(true)
      expect(res.data).toEqual({ total: 5, fresh: 3, expired: 2, totalHits: 11, tokensSaved: 2048 })
    })

    it('coerces string numerics to number', async () => {
      mockRpc({
        data: { total: '5', fresh: '3', expired: '2', total_hits: '11', tokens_saved: '2048' },
        error: null,
      })
      const res = await getCacheStats()
      expect(res.ok).toBe(true)
      expect(res.data.total).toBe(5)
      expect(res.data.tokensSaved).toBe(2048)
    })

    it('returns ok=false zeros when RPC errors', async () => {
      mockRpc({ data: null, error: { message: 'D1 unavailable' } })
      const res = await getCacheStats()
      expect(res.ok).toBe(false)
      expect(res.data).toEqual({ total: 0, fresh: 0, expired: 0, totalHits: 0, tokensSaved: 0 })
    })

    it('returns ok=false zeros when createServerClient throws', async () => {
      vi.mocked(createServerClient).mockImplementation(() => {
        throw new Error('D1 binding unavailable')
      })
      const res = await getCacheStats()
      expect(res.ok).toBe(false)
      expect(res.data.total).toBe(0)
    })

    it('returns ok=false zeros when rpc rejects', async () => {
      const rpc = vi.fn().mockRejectedValue(new Error('boom'))
      vi.mocked(createServerClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createServerClient>)
      const res = await getCacheStats()
      expect(res.ok).toBe(false)
      expect(res.data.total).toBe(0)
    })
  })

  describe('getWorkflowStats', () => {
    it('returns workflow status counts with ok=true', async () => {
      mockRpc({
        data: { queued: 2, running: 1, completed: 7, failed: 0 },
        error: null,
      })
      const res = await getWorkflowStats()
      expect(res.ok).toBe(true)
      expect(res.data).toEqual({ queued: 2, running: 1, completed: 7, failed: 0 })
    })

    it('returns ok=false zeros when RPC errors', async () => {
      mockRpc({ data: null, error: { message: 'fail' } })
      const res = await getWorkflowStats()
      expect(res.ok).toBe(false)
      expect(res.data).toEqual({ queued: 0, running: 0, completed: 0, failed: 0 })
    })
  })

  describe('getSignalsStats', () => {
    it('maps rows to {eventType, count} with ok=true', async () => {
      mockRpc({
        data: [
          { event_type: 'signup_completed', cnt: 10 },
          { event_type: 'payment_succeeded', cnt: 3 },
        ],
        error: null,
      })
      const res = await getSignalsStats()
      expect(res.ok).toBe(true)
      expect(res.data).toEqual([
        { eventType: 'signup_completed',  count: 10 },
        { eventType: 'payment_succeeded', count: 3 },
      ])
    })

    it('passes limit to RPC', async () => {
      const rpc = mockRpc({ data: [], error: null })
      await getSignalsStats(5)
      expect(rpc).toHaveBeenCalledWith('signals_top_events_24h', { p_limit: 5 })
    })

    it('returns ok=false [] on RPC error', async () => {
      mockRpc({ data: null, error: { message: 'fail' } })
      const res = await getSignalsStats()
      expect(res.ok).toBe(false)
      expect(res.data).toEqual([])
    })

    it('returns ok=false [] on rpc rejection', async () => {
      const rpc = vi.fn().mockRejectedValue(new Error('boom'))
      vi.mocked(createServerClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createServerClient>)
      const res = await getSignalsStats()
      expect(res.ok).toBe(false)
      expect(res.data).toEqual([])
    })
  })

  describe('cacheHitRate', () => {
    it('returns 0 when no activity', () => {
      expect(cacheHitRate({ total: 0, fresh: 0, expired: 0, totalHits: 0, tokensSaved: 0 })).toBe(0)
    })

    it('computes hits / (hits + unique entries)', () => {
      // 10 hits on 5 entries → 10 / (10 + 5) = 2/3
      const rate = cacheHitRate({ total: 5, fresh: 5, expired: 0, totalHits: 10, tokensSaved: 0 })
      expect(rate).toBeCloseTo(10 / 15)
    })

    it('returns fraction in [0, 1]', () => {
      const rate = cacheHitRate({ total: 1, fresh: 1, expired: 0, totalHits: 99, tokensSaved: 0 })
      expect(rate).toBeGreaterThan(0)
      expect(rate).toBeLessThanOrEqual(1)
    })
  })
})
