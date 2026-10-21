/**
 * Commission ledger mutations — the batch-claim invariant.
 *
 * These cover the claim SQL in this module. The claim the payout cron actually
 * runs is `claimPayableRows` in
 * `src/forest/jobs/payout-batcher/payout-batcher-claims.ts`; it carries the same
 * two-clause guard and is covered by `payout-batcher-claims.test.ts` alongside
 * this one. Real SQLite rather than a mock, because a mocked db would return
 * whatever a test asked for and could not prove the WHERE clause holds.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'

vi.mock('@/seed/db/client', () => ({ getD1: vi.fn() }))

import { getD1 } from '@/seed/db/client'
import { claimLedgerRows, markLedgerPaid, rollbackPayingRows } from './commission-ledger-mutations'

/**
 * Mirrors the production columns the mutations read and write. Real SQL is the
 * point of this file: a mocked db could not prove the WHERE clause works.
 */
function fixture(rows: Array<[string, string, string | null]>) {
  const raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE commission_ledger (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      payout_batch_id TEXT,
      commission_cents INTEGER NOT NULL DEFAULT 0,
      withheld_cents INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER,
      paid_at INTEGER
    );
  `)
  for (const [id, status, batchId] of rows) {
    raw.prepare(`INSERT INTO commission_ledger (id, status, payout_batch_id) VALUES (?, ?, ?)`)
      .run(id, status, batchId)
  }
  const prepare = (sql: string) => {
    const statement = raw.prepare(sql)
    return {
      bind: (...args: unknown[]) => ({
        run: async () => {
          const info = statement.run(...(args as never[]))
          return { success: true, meta: { changes: Number(info.changes) } }
        },
      }),
    }
  }
  return { prepare, state: (id: string) => raw.prepare(
    `SELECT status, payout_batch_id FROM commission_ledger WHERE id = ?`).get(id) as {
      status: string; payout_batch_id: string | null } }
}

function useDb(db: ReturnType<typeof fixture>) {
  vi.mocked(getD1).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getD1>>)
}

describe('claimLedgerRows', () => {
  beforeEach(() => vi.clearAllMocks())

  it('claims only payable rows and returns how many were actually claimed', async () => {
    const db = fixture([
      ['a', 'payable', null],
      ['b', 'payable', null],
      ['c', 'paying', 'other-batch'],
      ['d', 'paid', 'old-batch'],
    ])
    useDb(db)

    const claimed = await claimLedgerRows(['a', 'b', 'c', 'd'], 'batch-1')

    expect(claimed).toBe(2)
    expect(db.state('a').status).toBe('paying')
    expect(db.state('a').payout_batch_id).toBe('batch-1')
    // Rows already claimed by another batch are untouched.
    expect(db.state('c').payout_batch_id).toBe('other-batch')
    expect(db.state('d').status).toBe('paid')
  })

  it('claims nothing on a second call for the same ids (Inngest retry safety)', async () => {
    const db = fixture([['a', 'payable', null], ['b', 'payable', null]])
    useDb(db)

    const first = await claimLedgerRows(['a', 'b'], 'batch-1')
    const second = await claimLedgerRows(['a', 'b'], 'batch-1')

    expect(first).toBe(2)
    expect(second).toBe(0)
  })

  it('does not let a retry steal rows another batch already claimed', async () => {
    const db = fixture([['a', 'payable', null]])
    useDb(db)

    expect(await claimLedgerRows(['a'], 'batch-1')).toBe(1)
    expect(await claimLedgerRows(['a'], 'batch-2')).toBe(0)
    expect(db.state('a').payout_batch_id).toBe('batch-1')
  })

  it('returns 0 without touching the database for an empty id list', async () => {
    const db = fixture([['a', 'payable', null]])
    useDb(db)

    expect(await claimLedgerRows([], 'batch-1')).toBe(0)
    expect(db.state('a').status).toBe('payable')
  })

  it('refuses a payable row that still carries another batch id', async () => {
    // A failed rollback can leave a row 'payable' with its old batch id intact.
    // The status term alone would let this be claimed, double-paying the
    // affiliate once the first batch settles, so the batch-id barrier must hold.
    const db = fixture([['a', 'payable', 'stale-batch']])
    useDb(db)

    expect(await claimLedgerRows(['a'], 'batch-1')).toBe(0)
    expect(db.state('a').payout_batch_id).toBe('stale-batch')
  })
})

describe('markLedgerPaid', () => {
  beforeEach(() => vi.clearAllMocks())

  it('advances only the paying rows of the same batch', async () => {
    const db = fixture([
      ['a', 'paying', 'batch-1'],
      ['b', 'paying', 'batch-1'],
      ['c', 'paying', 'other-batch'],
    ])
    useDb(db)

    await markLedgerPaid(['a', 'b'], 'batch-1')

    expect(db.state('a').status).toBe('paid')
    expect(db.state('b').status).toBe('paid')
    // The transition is scoped to this batch, so another batch's row survives
    // even though its id was not in the list.
    expect(db.state('c').status).toBe('paying')
  })
})

describe('rollbackPayingRows', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the batch rows to payable so a later run can retry them', async () => {
    const db = fixture([
      ['a', 'paying', 'batch-1'],
      ['b', 'paying', 'other-batch'],
    ])
    useDb(db)

    await rollbackPayingRows('batch-1')

    expect(db.state('a').status).toBe('payable')
    expect(db.state('a').payout_batch_id).toBeNull()
    expect(db.state('b').status).toBe('paying')
  })
})
