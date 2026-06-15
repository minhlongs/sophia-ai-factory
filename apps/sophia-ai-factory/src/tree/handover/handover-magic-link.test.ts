/**
 * Tests for handover magic link (PROTECTED FLOW — customer onboarding).
 *
 * Pins single-use semantics: token generation, expiry windows (24h default
 * vs 72h for auto_signup/auto_payment), consume-race winner via
 * changes>0, idempotent markFirstRun/markFirstSopInstall, swallow-errors
 * on side-effect helpers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }))

vi.mock('@/seed/db/client', () => ({
  getD1: mockGetD1,
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  generateToken,
  createMagicLinkToken,
  validateMagicLinkToken,
  consumeMagicLink,
  markFirstRun,
  markFirstSopInstall,
} from './handover-magic-link'
import { logger } from '@/seed/utils/logger-utility'

interface ExecutedQuery {
  sql: string
  bindings: unknown[]
}

interface MockD1Options {
  firstRow?: Record<string, unknown> | null
  runMeta?: { changes?: number }
  runError?: Error
  firstError?: Error
}

function createMockD1(opts: MockD1Options = {}) {
  const executed: ExecutedQuery[] = []
  const stmt = (sql: string) => {
    const current: ExecutedQuery = { sql, bindings: [] }
    executed.push(current)
    const bound = {
      bind: (...args: unknown[]) => {
        current.bindings = args
        return bound
      },
      first: async () => {
        if (opts.firstError) throw opts.firstError
        return opts.firstRow ?? null
      },
      run: async () => {
        if (opts.runError) throw opts.runError
        return { success: true, meta: opts.runMeta ?? { changes: 1 } }
      },
    }
    return bound
  }
  const db = { prepare: stmt } as unknown as Awaited<ReturnType<typeof import('@/seed/db/client').getD1>>
  return { db, executed }
}

const FIXED_NOW = new Date('2026-05-11T12:00:00Z')
const FIXED_NOW_SEC = Math.floor(FIXED_NOW.getTime() / 1000)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('generateToken', () => {
  it('returns a 64-char hex string (2 concatenated uuids without dashes)', () => {
    const token = generateToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns distinct tokens on successive calls', () => {
    expect(generateToken()).not.toBe(generateToken())
  })
})

describe('createMagicLinkToken', () => {
  it('persists token + ISO-seconds expiry (default 24h) on customer_handovers', async () => {
    const { db, executed } = createMockD1()
    mockGetD1.mockReturnValue(db);

    const token = await createMagicLinkToken('hand-1')

    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(executed).toHaveLength(1)
    expect(executed[0].sql).toContain('UPDATE customer_handovers')
    expect(executed[0].sql).toContain('SET magic_link_token = ?1, magic_link_expires_at = ?2')
    expect(executed[0].bindings[0]).toBe(token)
    expect(executed[0].bindings[1]).toBe(FIXED_NOW_SEC + 24 * 3600)
    expect(executed[0].bindings[2]).toBe('hand-1')
  })

  it('uses 72h expiry for source=auto_signup', async () => {
    const { db, executed } = createMockD1()
    mockGetD1.mockReturnValue(db);

    await createMagicLinkToken('hand-1', { source: 'auto_signup' })

    expect(executed[0].bindings[1]).toBe(FIXED_NOW_SEC + 72 * 3600)
  })

  it('uses 72h expiry for source=auto_payment', async () => {
    const { db, executed } = createMockD1()
    mockGetD1.mockReturnValue(db);

    await createMagicLinkToken('hand-1', { source: 'auto_payment' })

    expect(executed[0].bindings[1]).toBe(FIXED_NOW_SEC + 72 * 3600)
  })

  it('honors explicit ttlHours override (wins over source defaulting)', async () => {
    const { db, executed } = createMockD1()
    mockGetD1.mockReturnValue(db);

    await createMagicLinkToken('hand-1', { ttlHours: 1, source: 'auto_signup' })

    expect(executed[0].bindings[1]).toBe(FIXED_NOW_SEC + 1 * 3600)
  })

  it('uses 24h default for unknown source values', async () => {
    const { db, executed } = createMockD1()
    mockGetD1.mockReturnValue(db);

    await createMagicLinkToken('hand-1', { source: 'manual' })

    expect(executed[0].bindings[1]).toBe(FIXED_NOW_SEC + 24 * 3600)
  })
})

describe('validateMagicLinkToken', () => {
  it('returns handover row when token found + not expired', async () => {
    const row = { id: 'hand-1', customer_user_id: 'user-1', magic_link_token: 'tok' }
    const { db, executed } = createMockD1({ firstRow: row })
    mockGetD1.mockReturnValue(db);

    const result = await validateMagicLinkToken('tok-abc')

    expect(result).toEqual(row)
    expect(executed[0].sql).toContain('SELECT * FROM customer_handovers')
    expect(executed[0].sql).toContain('magic_link_expires_at > ?2')
    expect(executed[0].bindings[0]).toBe('tok-abc')
    expect(executed[0].bindings[1]).toBe(FIXED_NOW_SEC)
  })

  it('returns null when no row matches (expired or wrong token)', async () => {
    const { db } = createMockD1({ firstRow: null })
    mockGetD1.mockReturnValue(db);

    const result = await validateMagicLinkToken('expired-tok')

    expect(result).toBeNull()
  })

  it('returns null + logs error when DB query throws (no propagation)', async () => {
    const { db } = createMockD1({ firstError: new Error('D1 timeout') })
    mockGetD1.mockReturnValue(db);

    const result = await validateMagicLinkToken('tok')

    expect(result).toBeNull()
    expect(logger.error).toHaveBeenCalledWith(
      '[MagicLink] Validate error',
      expect.any(Error),
    )
  })
})

describe('consumeMagicLink (single-use semantics)', () => {
  it('returns true when UPDATE affects a row (caller won the race)', async () => {
    const { db, executed } = createMockD1({ runMeta: { changes: 1 } })
    mockGetD1.mockReturnValue(db);

    const won = await consumeMagicLink('hand-1', 'tok-abc')

    expect(won).toBe(true)
    expect(executed[0].sql).toContain('UPDATE customer_handovers')
    expect(executed[0].sql).toContain('magic_link_token = NULL')
    expect(executed[0].sql).toContain('magic_link_expires_at = NULL')
    expect(executed[0].sql).toContain('customer_first_login_at = COALESCE')
    expect(executed[0].sql).toContain('WHERE id = ?2 AND magic_link_token = ?3')
    expect(executed[0].bindings).toEqual([FIXED_NOW_SEC, 'hand-1', 'tok-abc'])
  })

  it('returns false when UPDATE changes 0 rows (race lost / already consumed)', async () => {
    const { db } = createMockD1({ runMeta: { changes: 0 } })
    mockGetD1.mockReturnValue(db);

    const won = await consumeMagicLink('hand-1', 'stale-tok')

    expect(won).toBe(false)
  })

  it('returns false when meta is absent (defensive default to 0 changes)', async () => {
    const { db } = createMockD1({ runMeta: {} })
    mockGetD1.mockReturnValue(db);

    const won = await consumeMagicLink('hand-1', 'tok-abc')

    expect(won).toBe(false)
  })
})

describe('markFirstRun (idempotent stamp)', () => {
  it('issues COALESCE UPDATE bound to customer_user_id', async () => {
    const { db, executed } = createMockD1()
    mockGetD1.mockReturnValue(db);

    await markFirstRun('user-1')

    expect(executed[0].sql).toContain('UPDATE customer_handovers')
    expect(executed[0].sql).toContain('customer_first_run_at = COALESCE(customer_first_run_at, ?1)')
    expect(executed[0].bindings).toEqual([FIXED_NOW_SEC, 'user-1'])
  })

  it('swallows errors with warn-level log (never blocks caller)', async () => {
    const { db } = createMockD1({ runError: new Error('table missing') })
    mockGetD1.mockReturnValue(db);

    await expect(markFirstRun('user-1')).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      '[MagicLink] markFirstRun failed',
      expect.objectContaining({ error: 'table missing' }),
    )
  })
})

describe('markFirstSopInstall (idempotent stamp)', () => {
  it('issues COALESCE UPDATE on customer_first_sop_install_at', async () => {
    const { db, executed } = createMockD1()
    mockGetD1.mockReturnValue(db);

    await markFirstSopInstall('user-1')

    expect(executed[0].sql).toContain(
      'customer_first_sop_install_at = COALESCE(customer_first_sop_install_at, ?1)',
    )
    expect(executed[0].bindings).toEqual([FIXED_NOW_SEC, 'user-1'])
  })

  it('swallows errors with warn-level log (never blocks caller)', async () => {
    const { db } = createMockD1({ runError: new Error('connection lost') })
    mockGetD1.mockReturnValue(db);

    await expect(markFirstSopInstall('user-1')).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      '[MagicLink] markFirstSopInstall failed',
      expect.objectContaining({ error: 'connection lost' }),
    )
  })
})
