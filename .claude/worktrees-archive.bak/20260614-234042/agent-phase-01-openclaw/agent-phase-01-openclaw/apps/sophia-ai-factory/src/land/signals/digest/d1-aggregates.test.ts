/**
 * Tests for D1 aggregate query functions
 *
 * Each test mocks the D1 stub returned by globalThis.__env.DB.
 * Tests cover: happy path, empty results, edge types (string counts from D1).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  querySignupStats,
  queryConversionsByTier,
  queryPaymentStats,
  queryTopByokProviders,
  queryAgentDispatches,
} from './d1-aggregates'

// ── D1 stub factory ────────────────────────────────────────────────────────────

/** Build a minimal D1Database stub with controlled first()/all() returns */
function makeDb(overrides: {
  first?: unknown
  all?: { results: unknown[] }
}): D1Database {
  const firstVal = overrides.first ?? null
  const allVal = overrides.all ?? { results: [] }

  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstVal),
    all: vi.fn().mockResolvedValue(allVal),
    run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
  }

  return {
    prepare: vi.fn().mockReturnValue(stmt),
    dump: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  } as unknown as D1Database
}

const WINDOW_MS = Date.now() - 7 * 24 * 60 * 60 * 1000

// ── Query 1: Signups ──────────────────────────────────────────────────────────

describe('querySignupStats()', () => {
  it('returns count from D1 row', async () => {
    const db = makeDb({ first: { count: 42 } })
    const result = await querySignupStats(db, WINDOW_MS)
    expect(result.count).toBe(42)
  })

  it('returns 0 when D1 returns null row', async () => {
    const db = makeDb({ first: null })
    const result = await querySignupStats(db, WINDOW_MS)
    expect(result.count).toBe(0)
  })

  it('coerces string count (D1 may return strings)', async () => {
    const db = makeDb({ first: { count: '17' } })
    const result = await querySignupStats(db, WINDOW_MS)
    expect(result.count).toBe(17)
  })

  it('passes windowMs as bind parameter', async () => {
    const db = makeDb({ first: { count: 0 } })
    const ts = 1_700_000_000_000
    await querySignupStats(db, ts)
    const stmt = (db.prepare as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(stmt.bind).toHaveBeenCalledWith(ts)
  })
})

// ── Query 2: Conversions ──────────────────────────────────────────────────────

describe('queryConversionsByTier()', () => {
  it('returns typed rows sorted by count desc', async () => {
    const db = makeDb({
      all: {
        results: [
          { to_tier: 'PREMIUM', count: 10 },
          { to_tier: 'ENTERPRISE', count: 3 },
        ],
      },
    })
    const rows = await queryConversionsByTier(db, WINDOW_MS)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ to_tier: 'PREMIUM', count: 10 })
    expect(rows[1]).toEqual({ to_tier: 'ENTERPRISE', count: 3 })
  })

  it('filters out null to_tier rows', async () => {
    const db = makeDb({
      all: {
        results: [
          { to_tier: null, count: 5 },
          { to_tier: 'MASTER', count: 2 },
        ],
      },
    })
    const rows = await queryConversionsByTier(db, WINDOW_MS)
    expect(rows).toHaveLength(1)
    expect(rows[0].to_tier).toBe('MASTER')
  })

  it('returns empty array when no conversions', async () => {
    const db = makeDb({ all: { results: [] } })
    const rows = await queryConversionsByTier(db, WINDOW_MS)
    expect(rows).toEqual([])
  })
})

// ── Query 3: Payment stats ────────────────────────────────────────────────────

describe('queryPaymentStats()', () => {
  it('aggregates success count, failed count, and total_usd', async () => {
    // prepare() is called twice — once for success, once for failed
    const successStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ cnt: 8, total: 392.5 }),
      all: vi.fn(),
      run: vi.fn(),
    }
    const failedStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ cnt: 2 }),
      all: vi.fn(),
      run: vi.fn(),
    }
    const db = {
      prepare: vi.fn().mockReturnValueOnce(successStmt).mockReturnValueOnce(failedStmt),
      dump: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(),
    } as unknown as D1Database

    const result = await queryPaymentStats(db, WINDOW_MS)
    expect(result.success_count).toBe(8)
    expect(result.failed_count).toBe(2)
    expect(result.total_usd).toBeCloseTo(392.5)
  })

  it('returns zeros when both queries return null', async () => {
    const nullStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn(),
      run: vi.fn(),
    }
    const db = {
      prepare: vi.fn().mockReturnValue(nullStmt),
      dump: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(),
    } as unknown as D1Database

    const result = await queryPaymentStats(db, WINDOW_MS)
    expect(result).toEqual({ success_count: 0, failed_count: 0, total_usd: 0 })
  })
})

// ── Query 4: BYOK providers ───────────────────────────────────────────────────

describe('queryTopByokProviders()', () => {
  it('returns provider rows with call counts', async () => {
    const db = makeDb({
      all: {
        results: [
          { provider: 'elevenlabs', call_count: 150 },
          { provider: 'openrouter', call_count: 80 },
        ],
      },
    })
    const rows = await queryTopByokProviders(db, WINDOW_MS)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ provider: 'elevenlabs', call_count: 150 })
  })

  it('filters null provider rows', async () => {
    const db = makeDb({
      all: {
        results: [{ provider: null, call_count: 5 }],
      },
    })
    const rows = await queryTopByokProviders(db, WINDOW_MS)
    expect(rows).toHaveLength(0)
  })
})

// ── Query 5: Agent dispatches ─────────────────────────────────────────────────

describe('queryAgentDispatches()', () => {
  it('returns dispatch rows', async () => {
    const db = makeDb({
      all: {
        results: [
          { command: '/campaign', dispatch_count: 24 },
          { command: 'unknown', dispatch_count: 3 },
        ],
      },
    })
    const rows = await queryAgentDispatches(db, WINDOW_MS)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ command: '/campaign', dispatch_count: 24 })
  })

  it('maps null command to "unknown"', async () => {
    const db = makeDb({
      all: {
        results: [{ command: null, dispatch_count: 1 }],
      },
    })
    const rows = await queryAgentDispatches(db, WINDOW_MS)
    expect(rows[0].command).toBe('unknown')
  })

  it('returns empty array when no dispatches', async () => {
    const db = makeDb({ all: { results: [] } })
    const rows = await queryAgentDispatches(db, WINDOW_MS)
    expect(rows).toEqual([])
  })
})
