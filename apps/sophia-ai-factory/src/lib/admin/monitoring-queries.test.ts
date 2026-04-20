import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getCacheStats,
  getWorkflowStats,
  getSignalsStats,
  getTraceStats,
  cacheHitRate,
  aggregateByokEvents,
} from './monitoring-queries'
import { createServerClient } from '@/lib/db/client'
import type { TraceRow } from '@/lib/admin/trace-aggregator'

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

// ── getTraceStats — Phase 4K SSR helper ──────────────────────────────────────

function buildD1(rows: TraceRow[]) {
  const bindMock = vi.fn().mockReturnValue({
    all: vi.fn().mockResolvedValue({ results: rows }),
  })
  const prepareMock = vi.fn().mockReturnValue({ bind: bindMock })
  return { DB: { prepare: prepareMock }, _prepareMock: prepareMock, _bindMock: bindMock }
}

function buildThrowingD1() {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error('D1 boom')),
        }),
      }),
    },
  }
}

describe('getTraceStats', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).DB
  })

  it('happy path: 3 rows → returns aggregated TraceStats shape', async () => {
    const rows: TraceRow[] = [
      { props: JSON.stringify({ ok: true,  provider: 'openrouter',  model: 'gpt-4o-mini',     duration_ms: 120, trace_id: 'a', workflow_id: 'w1', step_order: 1, step_type: 'plan' }) },
      { props: JSON.stringify({ ok: true,  provider: 'anthropic',   model: 'claude-sonnet-4', duration_ms: 200, trace_id: 'b', workflow_id: 'w1', step_order: 2, step_type: 'write' }) },
      { props: JSON.stringify({ ok: false, provider: 'openrouter',  model: 'gpt-4o-mini',     duration_ms: 80,  trace_id: 'c', workflow_id: 'w2', step_order: 1, step_type: 'plan' }) },
    ]
    const d1 = buildD1(rows)
    Object.assign(globalThis, { DB: d1.DB })

    const result = await getTraceStats()

    // Verify SQL uses ts >= ? not created_at
    const sql: string = d1._prepareMock.mock.calls[0][0] as string
    expect(sql).toContain('ts >= ?')
    expect(sql).not.toContain('created_at')
    expect(d1._bindMock).toHaveBeenCalledWith(expect.any(Number))

    expect(result).not.toBeNull()
    expect(result!.total).toBe(3)
    expect(result!.success).toBe(2)
    expect(result!.failure).toBe(1)
    expect(result!.successRate).toBeCloseTo(2 / 3)
    expect(result!.avgDurationMs).toBeCloseTo((120 + 200 + 80) / 3)
    expect(result!.byProvider[0]).toEqual({ provider: 'openrouter', count: 2 })
    expect(result!.byModel[0]).toEqual({ model: 'gpt-4o-mini', count: 2 })
  })

  it('returns null when D1 binding is missing (globalThis.DB unbound)', async () => {
    // DB not set on globalThis
    const result = await getTraceStats()
    expect(result).toBeNull()
  })

  it('returns null (no throw) when D1 query throws', async () => {
    Object.assign(globalThis, buildThrowingD1())
    const result = await getTraceStats()
    expect(result).toBeNull()
  })
})

// ── aggregateByokEvents — Phase 9A ───────────────────────────────────────────

function buildByokD1(rows: Array<{ event_type: string; cnt: number }>) {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: rows }),
        }),
      }),
    },
  }
}

describe('aggregateByokEvents', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).DB
  })

  it('returns zero counts when DB binding is absent', async () => {
    // globalThis.DB not set
    const result = await aggregateByokEvents()
    expect(result).toEqual({ setCount: 0, clearCount: 0, netChange: 0 })
  })

  it('counts set and clear separately and computes net change', async () => {
    Object.assign(globalThis, buildByokD1([
      { event_type: 'byok_key_set',     cnt: 5 },
      { event_type: 'byok_key_cleared', cnt: 2 },
    ]))
    const result = await aggregateByokEvents(24)
    expect(result.setCount).toBe(5)
    expect(result.clearCount).toBe(2)
    expect(result.netChange).toBe(3)
  })

  it('handles only set events (clear absent from results)', async () => {
    Object.assign(globalThis, buildByokD1([
      { event_type: 'byok_key_set', cnt: 7 },
    ]))
    const result = await aggregateByokEvents()
    expect(result.setCount).toBe(7)
    expect(result.clearCount).toBe(0)
    expect(result.netChange).toBe(7)
  })

  it('handles only clear events (set absent from results)', async () => {
    Object.assign(globalThis, buildByokD1([
      { event_type: 'byok_key_cleared', cnt: 3 },
    ]))
    const result = await aggregateByokEvents()
    expect(result.setCount).toBe(0)
    expect(result.clearCount).toBe(3)
    expect(result.netChange).toBe(-3)
  })

  it('returns zeros when query returns empty rows', async () => {
    Object.assign(globalThis, buildByokD1([]))
    const result = await aggregateByokEvents()
    expect(result).toEqual({ setCount: 0, clearCount: 0, netChange: 0 })
  })

  it('returns zeros (no throw) when D1 query rejects', async () => {
    Object.assign(globalThis, {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockRejectedValue(new Error('D1 boom')),
          }),
        }),
      },
    })
    const result = await aggregateByokEvents()
    expect(result).toEqual({ setCount: 0, clearCount: 0, netChange: 0 })
  })

  it('passes numeric unix-ms cutoff to the D1 bind call (not hoursBack)', async () => {
    const before = Date.now()
    const bindMock = vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: [] }),
    })
    const prepareMock = vi.fn().mockReturnValue({ bind: bindMock })
    Object.assign(globalThis, {
      DB: { prepare: prepareMock },
    })
    await aggregateByokEvents(48)
    // bind receives cutoffMs = Date.now() - 48 * 3600 * 1000
    const after = Date.now()
    expect(bindMock).toHaveBeenCalledWith(expect.any(Number))
    const [cutoff] = bindMock.mock.calls[0] as [number]
    expect(cutoff).toBeGreaterThan(before - 48 * 3600 * 1000 - 100)
    expect(cutoff).toBeLessThanOrEqual(after - 48 * 3600 * 1000 + 100)
    // SQL must use ts >= ? not created_at
    const sql: string = prepareMock.mock.calls[0][0] as string
    expect(sql).toContain('ts >= ?')
    expect(sql).not.toContain('created_at')
  })
})
