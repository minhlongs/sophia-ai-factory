/**
 * Tests for GET /api/admin/llm-trace-stats — Phase 4I.
 *
 * Covers: CRON_SECRET auth / D1 unavailable / happy path / D1 throws / pure aggregator edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { aggregateTraceStats } from '@/tree/admin/trace-aggregator'
import type { TraceRow } from '@/tree/admin/trace-aggregator'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildRequest(auth?: string): NextRequest {
  const headers = new Headers(auth ? { authorization: auth } : {})
  return { headers } as unknown as NextRequest
}

function makeRow(overrides: Partial<{
  ok: boolean; provider: string; model: string; duration_ms: number
}>): TraceRow {
  return {
    props: JSON.stringify({
      trace_id:    'wf-001-step-1',
      workflow_id: 'wf-001',
      step_order:  1,
      step_type:   'plan',
      provider:    overrides.provider ?? 'openrouter',
      model:       overrides.model    ?? 'gpt-4o-mini',
      duration_ms: overrides.duration_ms ?? 100,
      ok:          overrides.ok ?? true,
    }),
  }
}

// ── Sample rows: 2 success + 1 failure, 2 providers, 2 models ────────────────

const SAMPLE_ROWS: TraceRow[] = [
  makeRow({ ok: true,  provider: 'openrouter', model: 'gpt-4o-mini', duration_ms: 120 }),
  makeRow({ ok: true,  provider: 'anthropic',  model: 'claude-sonnet-4', duration_ms: 200 }),
  makeRow({ ok: false, provider: 'openrouter', model: 'gpt-4o-mini', duration_ms: 80 }),
]

// ── D1 binding mock factory ───────────────────────────────────────────────────

function buildDb(rows: TraceRow[]): { DB: unknown; _prepareMock: ReturnType<typeof vi.fn>; _bindMock: ReturnType<typeof vi.fn> } {
  const bindMock = vi.fn().mockReturnValue({
    all: vi.fn().mockResolvedValue({ results: rows }),
  })
  const prepareMock = vi.fn().mockReturnValue({ bind: bindMock })
  return { DB: { prepare: prepareMock }, _prepareMock: prepareMock, _bindMock: bindMock }
}

function buildThrowingDb(): { DB: unknown } {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error('D1 connection lost')),
        }),
      }),
    },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/admin/llm-trace-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'test-secret')
    // Remove DB from globalThis between tests
    delete (globalThis as Record<string, unknown>).DB
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete (globalThis as Record<string, unknown>).DB
  })

  it('returns 401 when CRON_SECRET header missing in production', async () => {
    const res = await GET(buildRequest())
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Unauthorized')
  })

  it('returns {ok:true, stats} on happy path with 3 sample rows (2 success, 1 failure, 2 providers, 2 models)', async () => {
    const db = buildDb(SAMPLE_ROWS)
    Object.assign(globalThis, { DB: db.DB })

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      ok: boolean
      ts: string
      windowHours: number
      stats: {
        total: number
        success: number
        failure: number
        successRate: number
        avgDurationMs: number
        byProvider: Array<{ provider: string; count: number }>
        byModel:    Array<{ model: string;    count: number }>
      }
    }

    // Verify SQL uses ts >= ? not created_at
    const sql: string = db._prepareMock.mock.calls[0][0] as string
    expect(sql).toContain('ts >= ?')
    expect(sql).not.toContain('created_at')
    expect(db._bindMock).toHaveBeenCalledWith(expect.any(Number))

    expect(body.ok).toBe(true)
    expect(body.windowHours).toBe(24)
    expect(typeof body.ts).toBe('string')

    const { stats } = body
    expect(stats.total).toBe(3)
    expect(stats.success).toBe(2)
    expect(stats.failure).toBe(1)
    expect(stats.successRate).toBeCloseTo(2 / 3)
    expect(stats.avgDurationMs).toBeCloseTo((120 + 200 + 80) / 3)

    // byProvider: openrouter×2 first, anthropic×1 second
    expect(stats.byProvider).toHaveLength(2)
    expect(stats.byProvider[0]).toEqual({ provider: 'openrouter', count: 2 })
    expect(stats.byProvider[1]).toEqual({ provider: 'anthropic',  count: 1 })

    // byModel: gpt-4o-mini×2 first, claude-sonnet-4×1 second
    expect(stats.byModel).toHaveLength(2)
    expect(stats.byModel[0]).toEqual({ model: 'gpt-4o-mini',    count: 2 })
    expect(stats.byModel[1]).toEqual({ model: 'claude-sonnet-4', count: 1 })
  })

  it('returns {ok:false, reason:"D1_UNAVAILABLE"} when DB binding missing', async () => {
    // DB not set on globalThis
    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; reason: string }
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('D1_UNAVAILABLE')
  })

  it('returns {ok:false, reason:"D1_ERROR"} when D1 throws', async () => {
    Object.assign(globalThis, buildThrowingDb())

    const res = await GET(buildRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; reason: string; error: string }
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('D1_ERROR')
    expect(body.error).toBe('D1 connection lost')
  })
})

// ── Pure aggregator edge cases ────────────────────────────────────────────────

describe('aggregateTraceStats', () => {
  it('returns all zeros / empty arrays on empty input (no NaN)', () => {
    const result = aggregateTraceStats([])
    expect(result.total).toBe(0)
    expect(result.success).toBe(0)
    expect(result.failure).toBe(0)
    expect(result.successRate).toBe(0)
    expect(result.avgDurationMs).toBe(0)
    expect(result.byProvider).toEqual([])
    expect(result.byModel).toEqual([])
    // Explicitly ensure no NaN
    expect(Number.isNaN(result.successRate)).toBe(false)
    expect(Number.isNaN(result.avgDurationMs)).toBe(false)
  })

  it('skips malformed JSON rows without throwing', () => {
    const rows: TraceRow[] = [
      { props: 'not-json' },
      makeRow({ ok: true, provider: 'anthropic', model: 'claude-sonnet-4', duration_ms: 150 }),
    ]
    const result = aggregateTraceStats(rows)
    // Only the valid row counted
    expect(result.total).toBe(2)   // rows.length always = 2
    expect(result.success).toBe(1) // only the parseable row is ok:true
  })
})
