/**
 * Tests for handover account setup (D1 database operations).
 *
 * Pins the SQL contract for new-customer provisioning: user creation,
 * personal org bootstrap, subscription upsert, SOP pre-install, handover
 * record creation. Uses a stateful D1Database mock that records prepared
 * statements + bindings and routes responses by query pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import {
  createCustomerUser,
  ensureCustomerOrg,
  upsertUserTier,
  preInstallSops,
  createHandoverRecord,
} from './handover-account-setup'
import { logger } from '@/seed/utils/logger-utility'

interface ExecutedQuery {
  sql: string
  bindings: unknown[]
}

interface MockD1Options {
  /** Map of SQL substring → row to return from .first() */
  firstResults?: Array<{ match: string | RegExp; row: Record<string, unknown> | null }>
  /** Map of SQL substring → throw error from .run() */
  runErrors?: Array<{ match: string | RegExp; err: Error }>
}

function createMockD1(opts: MockD1Options = {}) {
  const executed: ExecutedQuery[] = []

  const stmt = (sql: string) => {
    const current: ExecutedQuery = { sql, bindings: [] }
    executed.push(current)

    const matchesAny = (matchers?: Array<{ match: string | RegExp }>) =>
      matchers?.find((m) =>
        typeof m.match === 'string' ? sql.includes(m.match) : m.match.test(sql),
      )

    const bound = {
      bind: (...args: unknown[]) => {
        current.bindings = args
        return bound
      },
      first: async <T,>(): Promise<T | null> => {
        const hit = matchesAny(opts.firstResults)
        if (!hit) return null
        return (hit as { row: T | null }).row
      },
      run: async () => {
        const errHit = matchesAny(opts.runErrors)
        if (errHit) throw (errHit as { err: Error }).err
        return { success: true, meta: {} }
      },
    }
    return bound
  }

  const db = { prepare: stmt } as unknown as D1Database
  return { db, executed }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createCustomerUser', () => {
  it('inserts into user table with customer role + verified email', async () => {
    const { db, executed } = createMockD1()

    const userId = await createCustomerUser(db, 'new@example.com', 'New Customer')

    expect(executed).toHaveLength(1)
    expect(executed[0].sql).toContain('INSERT INTO user')
    expect(executed[0].sql).toContain("role")
    expect(executed[0].sql).toContain("'customer'")
    expect(executed[0].bindings[0]).toBe(userId)
    expect(executed[0].bindings[1]).toBe('new@example.com')
    expect(executed[0].bindings[2]).toBe('New Customer')
    expect(typeof executed[0].bindings[3]).toBe('string') // ISO timestamp
  })

  it('returns a 32-char hex id (uuid without dashes)', async () => {
    const { db } = createMockD1()
    const id = await createCustomerUser(db, 'a@b.c', 'A')
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('ensureCustomerOrg', () => {
  it('returns existing org id when slug already present (idempotent)', async () => {
    const { db, executed } = createMockD1({
      firstResults: [{ match: 'FROM organizations WHERE slug', row: { id: 'existing-org-1' } }],
    })

    const orgId = await ensureCustomerOrg(db, 'abcdef0123456789', 'user@example.com')

    expect(orgId).toBe('existing-org-1')
    // Only the SELECT runs — no INSERTs follow
    expect(executed.filter((q) => q.sql.includes('INSERT'))).toHaveLength(0)
  })

  it('creates org + owner member + balances when slug is new', async () => {
    const { db, executed } = createMockD1() // no existing → first() returns null

    const orgId = await ensureCustomerOrg(db, 'abcdef0123456789', 'user@example.com')

    const sqls = executed.map((q) => q.sql)
    expect(sqls.some((s) => s.includes('SELECT id FROM organizations'))).toBe(true)
    expect(sqls.some((s) => s.includes('INSERT INTO organizations'))).toBe(true)
    expect(sqls.some((s) => s.includes('INSERT OR IGNORE INTO org_members'))).toBe(true)
    expect(sqls.some((s) => s.includes('INSERT OR IGNORE INTO org_balances'))).toBe(true)
    expect(orgId).toMatch(/^[0-9a-f]{32}$/)
  })

  it('derives slug from first 8 chars of userId', async () => {
    const { db, executed } = createMockD1()
    await ensureCustomerOrg(db, 'abcdef0123456789', 'user@example.com')

    const selectQuery = executed.find((q) => q.sql.includes('SELECT id FROM organizations'))
    expect(selectQuery?.bindings[0]).toBe('customer-abcdef01')
  })

  it('derives org name from email local-part (before @)', async () => {
    const { db, executed } = createMockD1()
    await ensureCustomerOrg(db, 'abcdef0123456789', 'jane.doe@example.com')

    const orgInsert = executed.find((q) => q.sql.includes('INSERT INTO organizations'))
    // bindings: [orgId, displayName, slug, nowSec]
    expect(orgInsert?.bindings[1]).toBe('jane.doe')
  })

  it('warns but does not throw when org_balances insert fails', async () => {
    const { db, executed } = createMockD1({
      runErrors: [{ match: 'org_balances', err: new Error('balances table missing') }],
    })

    const orgId = await ensureCustomerOrg(db, 'abcdef0123456789', 'u@example.com')

    expect(orgId).toMatch(/^[0-9a-f]{32}$/)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('org_balances insert failed'),
      expect.any(Error),
    )
    // org + member inserts still happened
    expect(executed.some((q) => q.sql.includes('INSERT INTO organizations'))).toBe(true)
  })
})

describe('upsertUserTier', () => {
  it('inserts subscription with uppercased tier + active status', async () => {
    const { db, executed } = createMockD1()

    await upsertUserTier(db, 'user-id-32-hex-abc', 'premium', 'user@example.com')

    const subInsert = executed.find((q) => q.sql.includes('INSERT OR REPLACE INTO subscriptions'))
    expect(subInsert).toBeDefined()
    expect(subInsert?.sql).toContain("'active'")
    // bindings: [id, orgId, userId, tier_upper, nowSec]
    expect(subInsert?.bindings[2]).toBe('user-id-32-hex-abc')
    expect(subInsert?.bindings[3]).toBe('PREMIUM')
  })

  it('falls back to userId for displayName when email is empty', async () => {
    const { db, executed } = createMockD1()

    await upsertUserTier(db, 'abcdef0123456789xx', 'BASIC')

    // ensureCustomerOrg uses email||userId for display name
    const orgInsert = executed.find((q) => q.sql.includes('INSERT INTO organizations'))
    expect(orgInsert?.bindings[1]).toBe('abcdef0123456789xx')
  })

  it('throws + logs when subscription insert fails', async () => {
    const { db } = createMockD1({
      runErrors: [{ match: 'INSERT OR REPLACE INTO subscriptions', err: new Error('FK fail') }],
    })

    await expect(upsertUserTier(db, 'user-1', 'BASIC', 'x@y.z')).rejects.toThrow(
      /upsertUserTier failed: FK fail/,
    )
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('preInstallSops', () => {
  it('returns empty array when no slugs provided', async () => {
    const { db, executed } = createMockD1()
    const installed = await preInstallSops(db, 'user-1', [])
    expect(installed).toEqual([])
    expect(executed).toHaveLength(0)
  })

  it('skips slugs whose template is missing or unpublished', async () => {
    const { db } = createMockD1({
      firstResults: [
        { match: /WHERE slug = \?1 AND status = 'published'/, row: null },
      ],
    })

    const installed = await preInstallSops(db, 'user-1', ['sop-missing'])
    expect(installed).toEqual([])
  })

  it('installs slugs with published templates and returns them', async () => {
    let callIdx = 0
    const { db, executed } = createMockD1()
    // override prepare to alternate template found / not found
    const realPrepare = db.prepare
    ;(db as { prepare: typeof realPrepare }).prepare = (sql: string) => {
      const stmt = realPrepare.call(db, sql)
      if (sql.includes('FROM sop_templates')) {
        stmt.first = async () => {
          callIdx++
          if (callIdx === 1) return { id: 'tpl-1' }
          if (callIdx === 2) return null
          return { id: 'tpl-3' }
        }
      }
      return stmt
    }

    const installed = await preInstallSops(db, 'user-1', ['sop-A', 'sop-missing', 'sop-C'])

    expect(installed).toEqual(['sop-A', 'sop-C'])
    const installInserts = executed.filter((q) =>
      q.sql.includes('INSERT OR IGNORE INTO user_sop_installations'),
    )
    expect(installInserts).toHaveLength(2)
    // enabled=0 is hardcoded
    expect(installInserts[0].sql).toContain('0, 0,')
  })

  it('logs warn and continues when one SOP install throws', async () => {
    const { db } = createMockD1({
      firstResults: [{ match: 'FROM sop_templates', row: { id: 'tpl-1' } }],
      runErrors: [{ match: 'user_sop_installations', err: new Error('table missing') }],
    })

    const installed = await preInstallSops(db, 'user-1', ['sop-A', 'sop-B'])
    expect(installed).toEqual([])
    expect(logger.warn).toHaveBeenCalled()
  })
})

describe('createHandoverRecord', () => {
  it('inserts customer_handovers row with JSON-encoded starter_sops + pending status', async () => {
    const { db, executed } = createMockD1()

    const handoverId = await createHandoverRecord(db, {
      userId: 'user-1',
      agencyName: 'Acme',
      agencyType: 'b2b_saas',
      tier: 'PREMIUM',
      installedSops: ['sop-1', 'sop-2'],
      adminId: 'admin-1',
    })

    expect(handoverId).toMatch(/^[0-9a-f]{32}$/)
    expect(executed).toHaveLength(1)
    expect(executed[0].sql).toContain('INSERT INTO customer_handovers')
    expect(executed[0].sql).toContain("'pending'")

    const bindings = executed[0].bindings
    expect(bindings[0]).toBe(handoverId)
    expect(bindings[1]).toBe('user-1')
    expect(bindings[2]).toBe('Acme')
    expect(bindings[3]).toBe('b2b_saas')
    expect(bindings[4]).toBe('PREMIUM')
    expect(bindings[5]).toBe(JSON.stringify(['sop-1', 'sop-2']))
    expect(bindings[6]).toBe('admin-1')
  })

  it("defaults source to 'manual' and triggerPaymentId to null", async () => {
    const { db, executed } = createMockD1()
    await createHandoverRecord(db, {
      userId: 'user-1',
      agencyName: 'A',
      agencyType: 'other',
      tier: 'BASIC',
      installedSops: [],
      adminId: 'admin-1',
    })
    const bindings = executed[0].bindings
    expect(bindings[8]).toBe('manual')
    expect(bindings[9]).toBeNull()
  })

  it('passes through source + triggerPaymentId when provided (auto_payment flow)', async () => {
    const { db, executed } = createMockD1()
    await createHandoverRecord(db, {
      userId: 'user-1',
      agencyName: 'A',
      agencyType: 'other',
      tier: 'BASIC',
      installedSops: [],
      adminId: 'admin-1',
      source: 'auto_payment',
      triggerPaymentId: 'pay-abc',
    })
    const bindings = executed[0].bindings
    expect(bindings[8]).toBe('auto_payment')
    expect(bindings[9]).toBe('pay-abc')
  })
})
