/**
 * Tests for violation logger read + analytics.
 *
 * Pins SQL filter chaining (LIKE 'violation:%' + optional eq/gte/lte), JSON
 * receipt parsing, ViolationType narrowing with fallback, and summary
 * aggregation (byType/byTier counts, billable credits, top-10 violators).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateServerClient } = vi.hoisted(() => ({ mockCreateServerClient: vi.fn() }))
vi.mock('@/seed/db/client', () => ({ createServerClient: mockCreateServerClient }))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { getViolationHistory, getViolationSummary } from './violation-logger-read'
import { logger } from '@/seed/utils/logger-utility'

interface CapturedQuery {
  table: string
  select: string
  like: [string, string] | null
  eq: Array<[string, unknown]>
  gte: Array<[string, unknown]>
  lte: Array<[string, unknown]>
  limit: number | null
  order: { column: string; ascending: boolean } | null
}

function setupMock(rows: unknown[] | null, error?: { message: string }) {
  const captured: CapturedQuery = {
    table: '',
    select: '',
    like: null,
    eq: [],
    gte: [],
    lte: [],
    limit: null,
    order: null,
  }

  // Builder is thenable (await calls it as a Promise)
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn((cols: string) => {
    captured.select = cols
    return builder
  })
  builder.like = vi.fn((col: string, pat: string) => {
    captured.like = [col, pat]
    return builder
  })
  builder.order = vi.fn((column: string, opts: { ascending: boolean }) => {
    captured.order = { column, ascending: opts.ascending }
    return builder
  })
  builder.limit = vi.fn((n: number) => {
    captured.limit = n
    return builder
  })
  builder.eq = vi.fn((col: string, val: unknown) => {
    captured.eq.push([col, val])
    return builder
  })
  builder.gte = vi.fn((col: string, val: unknown) => {
    captured.gte.push([col, val])
    return builder
  })
  builder.lte = vi.fn((col: string, val: unknown) => {
    captured.lte.push([col, val])
    return builder
  })
  builder.then = (resolve: (val: { data: unknown[] | null; error: { message: string } | null }) => void) =>
    resolve({ data: rows, error: error ?? null })

  mockCreateServerClient.mockReturnValue({
    from: vi.fn((table: string) => {
      captured.table = table
      return builder
    }),
  })
  return captured
}

beforeEach(() => {
  vi.clearAllMocks()
})

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'v-1',
    event_type: 'violation:QUOTA_EXCEEDED',
    user_id: 'user-1',
    license_nonce: 'nonce-1',
    tier: 'PREMIUM',
    receipt: JSON.stringify({ billable: true, exceeded_by: 50 }),
    created_at: 1_700_000_000,
    ...over,
  }
}

describe('getViolationHistory — query construction', () => {
  it('filters audit_logs by event_type LIKE "violation:%" and orders newest first', async () => {
    const captured = setupMock([])
    await getViolationHistory({})
    expect(captured.table).toBe('audit_logs')
    expect(captured.like).toEqual(['event_type', 'violation:%'])
    expect(captured.order).toEqual({ column: 'created_at', ascending: false })
  })

  it('uses default limit of 100 when not specified', async () => {
    const captured = setupMock([])
    await getViolationHistory({})
    expect(captured.limit).toBe(100)
  })

  it('honors explicit limit', async () => {
    const captured = setupMock([])
    await getViolationHistory({ limit: 50 })
    expect(captured.limit).toBe(50)
  })

  it('adds optional userId / licenseNonce / type / startDate / endDate filters', async () => {
    const captured = setupMock([])
    await getViolationHistory({
      userId: 'user-1',
      licenseNonce: 'nonce-1',
      type: 'QUOTA_EXCEEDED',
      startDate: 1_700_000_000,
      endDate: 1_700_086_400,
    })
    expect(captured.eq).toEqual([
      ['user_id', 'user-1'],
      ['license_nonce', 'nonce-1'],
      ['event_type', 'violation:QUOTA_EXCEEDED'],
    ])
    expect(captured.gte).toEqual([['created_at', 1_700_000_000]])
    expect(captured.lte).toEqual([['created_at', 1_700_086_400]])
  })
})

describe('getViolationHistory — row mapping', () => {
  it('parses receipt JSON string into metadata object', async () => {
    setupMock([row()])
    const result = await getViolationHistory({})
    expect(result[0].metadata).toEqual({ billable: true, exceeded_by: 50 })
  })

  it('strips "violation:" prefix from event_type and narrows to ViolationType', async () => {
    setupMock([row()])
    const result = await getViolationHistory({})
    expect(result[0].type).toBe('QUOTA_EXCEEDED')
  })

  it('falls back to QUOTA_EXCEEDED when event_type is unknown (defensive)', async () => {
    setupMock([row({ event_type: 'violation:NOT_A_REAL_TYPE' })])
    const result = await getViolationHistory({})
    expect(result[0].type).toBe('QUOTA_EXCEEDED')
  })

  it('coerces created_at to number when DB returns string', async () => {
    setupMock([row({ created_at: '1700000000' })])
    const result = await getViolationHistory({})
    expect(result[0].createdAt).toBe(1_700_000_000)
  })

  it('returns [] when DB returns error (no throw)', async () => {
    setupMock(null, { message: 'permission denied' })
    const result = await getViolationHistory({})
    expect(result).toEqual([])
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns [] for empty data with no error', async () => {
    setupMock(null)
    expect(await getViolationHistory({})).toEqual([])
  })
})

describe('getViolationSummary', () => {
  it('returns empty summary shape when no data', async () => {
    setupMock([])
    const summary = await getViolationSummary({ startDate: 0, endDate: 1 })
    expect(summary).toEqual({
      totalViolations: 0,
      byType: {},
      byTier: {},
      billableViolations: 0,
      totalBillableCredits: 0,
      topViolators: [],
    })
  })

  it('counts violations by type (event_type after stripping prefix)', async () => {
    setupMock([
      row({ event_type: 'violation:QUOTA_EXCEEDED' }),
      row({ event_type: 'violation:QUOTA_EXCEEDED' }),
      row({ event_type: 'violation:REQUEST_THROTTLED' }),
    ])
    const summary = await getViolationSummary({ startDate: 0, endDate: 1 })
    expect(summary.byType).toEqual({ QUOTA_EXCEEDED: 2, REQUEST_THROTTLED: 1 })
  })

  it('counts violations by tier (with UNKNOWN fallback)', async () => {
    setupMock([
      row({ tier: 'PREMIUM' }),
      row({ tier: 'PREMIUM' }),
      row({ tier: 'BASIC' }),
      row({ tier: null }),
    ])
    const summary = await getViolationSummary({ startDate: 0, endDate: 1 })
    expect(summary.byTier).toEqual({ PREMIUM: 2, BASIC: 1, UNKNOWN: 1 })
  })

  it('sums billable credits only from receipts where billable=true AND exceeded_by present', async () => {
    setupMock([
      row({ receipt: JSON.stringify({ billable: true, exceeded_by: 30 }) }),
      row({ receipt: JSON.stringify({ billable: true, exceeded_by: 70 }) }),
      row({ receipt: JSON.stringify({ billable: false, exceeded_by: 100 }) }), // skipped
      row({ receipt: JSON.stringify({ billable: true }) }), // no exceeded_by → skipped
    ])
    const summary = await getViolationSummary({ startDate: 0, endDate: 1 })
    expect(summary.billableViolations).toBe(2)
    expect(summary.totalBillableCredits).toBe(100)
    expect(summary.totalViolations).toBe(4)
  })

  it('builds top-10 violators sorted by billableCredits desc', async () => {
    const billable = (n: number) => JSON.stringify({ billable: true, exceeded_by: n })
    setupMock([
      row({ user_id: 'big-violator', receipt: billable(500) }),
      row({ user_id: 'big-violator', receipt: billable(200) }),
      row({ user_id: 'mid', receipt: billable(300) }),
      row({ user_id: 'small', receipt: billable(10) }),
    ])
    const summary = await getViolationSummary({ startDate: 0, endDate: 1 })
    expect(summary.topViolators).toEqual([
      { userId: 'big-violator', violationCount: 2, billableCredits: 700 },
      { userId: 'mid', violationCount: 1, billableCredits: 300 },
      { userId: 'small', violationCount: 1, billableCredits: 10 },
    ])
  })

  it('caps top violators at 10', async () => {
    const billable = (n: number) => JSON.stringify({ billable: true, exceeded_by: n })
    const rows = Array.from({ length: 15 }, (_, i) =>
      row({ user_id: `u-${i}`, receipt: billable(i + 1) }),
    )
    setupMock(rows)
    const summary = await getViolationSummary({ startDate: 0, endDate: 1 })
    expect(summary.topViolators).toHaveLength(10)
  })

  it('uses default limit of 1000 when not specified', async () => {
    const captured = setupMock([])
    await getViolationSummary({ startDate: 0, endDate: 1 })
    expect(captured.limit).toBe(1000)
  })

  it('parses receipt as object when DB returns parsed JSON (not string)', async () => {
    setupMock([
      // receipt already an object — Supabase JSONB sometimes returns parsed
      row({ receipt: { billable: true, exceeded_by: 42 } as unknown as string }),
    ])
    const summary = await getViolationSummary({ startDate: 0, endDate: 1 })
    expect(summary.totalBillableCredits).toBe(42)
  })
})
