/**
 * Commission Ledger — D1 persistence layer (insert + status flip)
 *
 * All money values are INTEGER cents (multiply USD × 100, C1).
 * Read queries live in commission-ledger-queries.ts.
 * Status mutations (claim/markPaid/rollback) in commission-ledger-mutations.ts.
 *
 * @module payouts/commission-ledger
 */

import { getD1 } from '@/seed/db/client'
import { toCents } from './commission-cents'
import type { InsertLedgerInput } from './commission-ledger-types'

export type { LedgerStatus, LedgerRow, InsertLedgerInput } from './commission-ledger-types'

/**
 * Insert a pending commission ledger row.
 * Converts USD → cents. Idempotent via IGNORE on UNIQUE(conversion_event_id).
 */
export async function insertPendingLedger(input: InsertLedgerInput): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      `INSERT OR IGNORE INTO commission_ledger
       (id, tenant_id, affiliate_id, conversion_event_id, offer_id,
        gross_cents, commission_pct, commission_cents, withheld_cents,
        status, payable_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?,?)`,
    )
    .bind(
      input.id, input.tenant_id, input.affiliate_id,
      input.conversion_event_id, input.offer_id,
      toCents(input.gross_amount_usd), input.commission_pct,
      toCents(input.commission_usd), input.withheld_cents ?? 0,
      input.payable_at, now, now,
    )
    .run()
}

/**
 * Flip pending → payable for rows whose payable_at has passed.
 */
export async function flipPendingToPayable(nowTs: number): Promise<number> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const result = await db
    .prepare(
      `UPDATE commission_ledger SET status = 'payable', updated_at = ?
       WHERE status = 'pending' AND payable_at <= ?`,
    )
    .bind(nowTs, nowTs)
    .run()
  return result.meta?.changes ?? 0
}

export {
  getPayableAggregates,
  getPayableLedgerIds,
  getEarningsSummary,
} from './commission-ledger-queries'

// Re-export mutations for convenience (single import point)
export {
  claimLedgerRows,
  markLedgerPaid,
  rollbackPayingRows,
  sumPaidCommissionsCents,
  getPaidBatchSummary,
} from './commission-ledger-mutations'
