/**
 * Tests for audit-log helpers: recordAudit, queryAuditTrail, TierEnum.
 * Uses an in-memory D1Database mock (no CF runtime required).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { recordAudit, queryAuditTrail, TierEnum, AuditActionSchema } from './audit-log'

// ── Minimal D1Database mock ────────────────────────────────────────────────────

interface MockRow {
  id: number
  table_name: string
  row_id: string
  action: string
  actor_id: string | null
  before_json: string | null
  after_json: string | null
  created_at: number
}

function makeD1Mock() {
  const rows: MockRow[] = []
  let nextId = 1

  const buildStmt = (sql: string) => {
    const boundArgs: unknown[] = []

    const stmt = {
      bind: (...args: unknown[]) => {
        boundArgs.push(...args)
        return stmt
      },
      run: async () => {
        const isInsert = /INSERT/i.test(sql)
        if (isInsert) {
          const [tableName, rowId, action, actorId, beforeJson, afterJson] = boundArgs as [
            string, string, string, string | null, string | null, string | null
          ]
          rows.push({
            id: nextId++,
            table_name: tableName,
            row_id: rowId,
            action,
            actor_id: actorId,
            before_json: beforeJson,
            after_json: afterJson,
            created_at: Date.now(),
          })
        }
        return { success: true, meta: {} }
      },
      all: async <T>() => {
        const isSelect = /SELECT/i.test(sql)
        if (!isSelect) return { results: [] as T[] }
        const [tableName, rowId, limit] = boundArgs as [string, string, number]
        const filtered = rows
          .filter(r => r.table_name === tableName && r.row_id === rowId)
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, limit)
        return { results: filtered as unknown as T[] }
      },
    }
    return stmt
  }

  const db = {
    prepare: (sql: string) => buildStmt(sql),
    _rows: rows,
  } as unknown as D1Database & { _rows: MockRow[] }

  return db
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('recordAudit', () => {
  it('inserts a row with correct fields', async () => {
    const db = makeD1Mock()
    await recordAudit(db, {
      tableName: 'subscriptions',
      rowId: 'org-123',
      action: 'update',
      actorId: 'user-abc',
      after: { tier: 'PREMIUM', status: 'active' },
    })

    const mock = db as unknown as { _rows: MockRow[] }
    expect(mock._rows).toHaveLength(1)
    const row = mock._rows[0]
    expect(row.table_name).toBe('subscriptions')
    expect(row.row_id).toBe('org-123')
    expect(row.action).toBe('update')
    expect(row.actor_id).toBe('user-abc')
    expect(row.before_json).toBeNull()
    expect(row.after_json).toBe(JSON.stringify({ tier: 'PREMIUM', status: 'active' }))
  })

  it('does not throw when DB binding throws (non-fatal path)', async () => {
    const brokenDb = {
      prepare: () => ({
        bind: () => ({ run: async () => { throw new Error('DB_UNAVAILABLE') } }),
      }),
    } as unknown as D1Database

    // Should not throw — audit failure is non-fatal
    await expect(
      recordAudit(brokenDb, { tableName: 'subscriptions', rowId: 'x', action: 'insert' })
    ).resolves.toBeUndefined()
  })

  it('serialises before/after JSON correctly when both provided', async () => {
    const db = makeD1Mock()
    const before = { tier: 'BASIC', status: 'active' }
    const after  = { tier: 'ENTERPRISE', status: 'active' }

    await recordAudit(db, {
      tableName: 'subscriptions',
      rowId: 'org-xyz',
      action: 'update',
      before,
      after,
    })

    const mock = db as unknown as { _rows: MockRow[] }
    expect(mock._rows[0].before_json).toBe(JSON.stringify(before))
    expect(mock._rows[0].after_json).toBe(JSON.stringify(after))
  })
})

describe('queryAuditTrail', () => {
  let db: D1Database & { _rows: MockRow[] }

  beforeEach(async () => {
    db = makeD1Mock()
    await recordAudit(db, { tableName: 'subscriptions', rowId: 'org-1', action: 'insert', after: { tier: 'BASIC' } })
    await recordAudit(db, { tableName: 'subscriptions', rowId: 'org-1', action: 'update', after: { tier: 'PREMIUM' } })
    await recordAudit(db, { tableName: 'subscriptions', rowId: 'org-2', action: 'insert', after: { tier: 'ENTERPRISE' } })
  })

  it('returns only rows for the specified table and rowId', async () => {
    const trail = await queryAuditTrail(db, 'subscriptions', 'org-1')
    expect(trail).toHaveLength(2)
    trail.forEach(r => {
      expect(r.table_name).toBe('subscriptions')
      expect(r.row_id).toBe('org-1')
    })
  })

  it('respects limit parameter', async () => {
    const trail = await queryAuditTrail(db, 'subscriptions', 'org-1', 1)
    expect(trail).toHaveLength(1)
  })

  it('returns empty array for unknown rowId', async () => {
    const trail = await queryAuditTrail(db, 'subscriptions', 'no-such-row')
    expect(trail).toHaveLength(0)
  })
})

describe('TierEnum + AuditActionSchema', () => {
  it('accepts valid tier values', () => {
    expect(TierEnum.safeParse('BASIC').success).toBe(true)
    expect(TierEnum.safeParse('PREMIUM').success).toBe(true)
    expect(TierEnum.safeParse('ENTERPRISE').success).toBe(true)
    expect(TierEnum.safeParse('MASTER').success).toBe(true)
  })

  it('rejects lowercase tier values', () => {
    expect(TierEnum.safeParse('basic').success).toBe(false)
    expect(TierEnum.safeParse('premium').success).toBe(false)
  })

  it('validates audit action enum', () => {
    expect(AuditActionSchema.safeParse('insert').success).toBe(true)
    expect(AuditActionSchema.safeParse('update').success).toBe(true)
    expect(AuditActionSchema.safeParse('delete').success).toBe(true)
    expect(AuditActionSchema.safeParse('upsert').success).toBe(false)
  })
})
