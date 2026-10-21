/**
 * The live payout claim — the one that actually moves money.
 *
 * `claimPayableRows` is what `payout-batcher-weekly` calls to lock a batch's
 * affiliate rows before dispatching to NOWPayments. It claims one row at a time
 * with a compare-and-set UPDATE, and `meta.changes === 0` is what makes a retry
 * a no-op instead of a second payment.
 *
 * The identical WHERE clause also exists in
 * `src/land/payouts/commission-ledger-mutations.ts`, but nothing in production
 * calls that copy — it is a re-export with no caller. So the invariant this file
 * pins belongs here, next to the code that spends. Real SQLite is the point: a
 * mocked db would return whatever the test asked for and could not prove the
 * guard holds.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'

import { claimPayableRows, queryPayableCommissions } from './payout-batcher-claims'
import { MIN_PAYOUT_THRESHOLD_CENTS } from './types'

/**
 * Mirrors the production columns the claim reads. Only the columns the two
 * statements touch are declared; the fixture exists to prove the WHERE clause,
 * not to model the table.
 */
function fixture(rows: Array<[string, string, string | null, number, string]>) {
  const raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE commission_ledger (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      payout_batch_id TEXT,
      commission_cents INTEGER NOT NULL DEFAULT 0,
      withheld_cents INTEGER NOT NULL DEFAULT 0,
      affiliate_id TEXT NOT NULL DEFAULT ''
    );
  `)
  for (const [id, status, batchId, cents, affiliate] of rows) {
    raw
      .prepare(
        `INSERT INTO commission_ledger
           (id, status, payout_batch_id, commission_cents, affiliate_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, status, batchId, cents, affiliate)
  }
  const prepare = (sql: string) => {
    const statement = raw.prepare(sql)
    return {
      // Reads call .all() straight off prepare(); writes bind then run.
      all: async () => ({ results: statement.all() }),
      bind: (...args: unknown[]) => ({
        run: async () => {
          const info = statement.run(...(args as never[]))
          return { success: true, meta: { changes: Number(info.changes) } }
        },
      }),
    }
  }
  return {
    prepare,
    state: (id: string) =>
      raw
        .prepare(
          `SELECT status, payout_batch_id FROM commission_ledger WHERE id = ?`,
        )
        .get(id) as { status: string; payout_batch_id: string | null },
  }
}

function useDb(db: ReturnType<typeof fixture>) {
  return db as unknown as D1Database
}

const THRESHOLD = 5000 // comfortably above MIN_PAYOUT_THRESHOLD_CENTS
const AFFILIATE_A = 'aff_a'
const AFFILIATE_B = 'aff_b'

describe('claimPayableRows — the double-payout guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('claims only payable rows and reports what it actually locked', async () => {
    const db = fixture([
      ['a', 'payable', null, THRESHOLD, AFFILIATE_A],
      ['b', 'payable', null, THRESHOLD, AFFILIATE_B],
      ['c', 'paying', 'other-batch', THRESHOLD, AFFILIATE_A],
      ['d', 'paid', 'old-batch', THRESHOLD, AFFILIATE_B],
    ])

    const summary = await claimPayableRows(useDb(db), 'batch-1', [
      { id: 'a', affiliate_id: AFFILIATE_A, commission_cents: THRESHOLD },
      { id: 'b', affiliate_id: AFFILIATE_B, commission_cents: THRESHOLD },
      { id: 'c', affiliate_id: AFFILIATE_A, commission_cents: THRESHOLD },
      { id: 'd', affiliate_id: AFFILIATE_B, commission_cents: THRESHOLD },
    ] as never)

    expect(summary.claimedRowIds).toEqual(['a', 'b'])
    expect(summary.totalAmountCents).toBe(THRESHOLD * 2)
    expect(summary.recipientCount).toBe(2)
    expect(db.state('a').status).toBe('paying')
    expect(db.state('a').payout_batch_id).toBe('batch-1')
    // Rows another batch already owns are untouched.
    expect(db.state('c').payout_batch_id).toBe('other-batch')
    expect(db.state('d').status).toBe('paid')
  })

  it('claims nothing on a second call for the same rows (retry safety)', async () => {
    const db = fixture([
      ['a', 'payable', null, THRESHOLD, AFFILIATE_A],
      ['b', 'payable', null, THRESHOLD, AFFILIATE_B],
    ])
    const rows = [
      { id: 'a', affiliate_id: AFFILIATE_A, commission_cents: THRESHOLD },
      { id: 'b', affiliate_id: AFFILIATE_B, commission_cents: THRESHOLD },
    ] as never

    const first = await claimPayableRows(useDb(db), 'batch-1', rows)
    const second = await claimPayableRows(useDb(db), 'batch-1', rows)

    expect(first.claimedRowIds).toHaveLength(2)
    expect(second.claimedRowIds).toEqual([])
    expect(second.totalAmountCents).toBe(0)
  })

  it('does not let a retry steal rows another batch already claimed', async () => {
    const db = fixture([['a', 'payable', null, THRESHOLD, AFFILIATE_A]])
    const rows = [{ id: 'a', affiliate_id: AFFILIATE_A, commission_cents: THRESHOLD }] as never

    expect((await claimPayableRows(useDb(db), 'batch-1', rows)).claimedRowIds).toEqual(['a'])
    expect((await claimPayableRows(useDb(db), 'batch-2', rows)).claimedRowIds).toEqual([])
    expect(db.state('a').payout_batch_id).toBe('batch-1')
  })

  it('refuses a payable row that still carries a stale batch id', async () => {
    // A run that dies after claiming but before its rollback leaves the row
    // 'payable' with the batch id still attached. Only the payout_batch_id
    // IS NULL term blocks this one: the status term alone would hand the row
    // to the new batch while the first may still settle, paying twice.
    const db = fixture([['a', 'payable', 'stale-batch', THRESHOLD, AFFILIATE_A]])

    const summary = await claimPayableRows(useDb(db), 'batch-1', [
      { id: 'a', affiliate_id: AFFILIATE_A, commission_cents: THRESHOLD },
    ] as never)

    expect(summary.claimedRowIds).toEqual([])
    expect(db.state('a').payout_batch_id).toBe('stale-batch')
  })

  it('skips a row below the payout threshold without claiming it', async () => {
    const db = fixture([
      ['small', 'payable', null, MIN_PAYOUT_THRESHOLD_CENTS - 1, AFFILIATE_A],
      ['big', 'payable', null, MIN_PAYOUT_THRESHOLD_CENTS + 1, AFFILIATE_B],
    ])

    const summary = await claimPayableRows(useDb(db), 'batch-1', [
      { id: 'small', affiliate_id: AFFILIATE_A, commission_cents: MIN_PAYOUT_THRESHOLD_CENTS - 1 },
      { id: 'big', affiliate_id: AFFILIATE_B, commission_cents: MIN_PAYOUT_THRESHOLD_CENTS + 1 },
    ] as never)

    expect(summary.claimedRowIds).toEqual(['big'])
    // The sub-threshold row stays claimable by a later batch.
    expect(db.state('small').status).toBe('payable')
  })
})

describe('queryPayableCommissions', () => {
  it('returns only payable rows with no batch id', async () => {
    const db = fixture([
      ['a', 'payable', null, THRESHOLD, AFFILIATE_A],
      ['b', 'paying', 'batch-1', THRESHOLD, AFFILIATE_B],
      ['c', 'payable', 'stale-batch', THRESHOLD, AFFILIATE_A],
    ])

    const { rows } = await queryPayableCommissions(useDb(db))

    expect(rows.map((r) => r.id)).toEqual(['a'])
  })
})
