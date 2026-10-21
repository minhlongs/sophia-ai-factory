/**
 * Commission Ledger Mutations — atomic status transitions + reconciliation queries
 *
 * Separated from commission-ledger.ts for file-size compliance (<200 lines).
 * All amounts in INTEGER cents (C1).
 *
 * @module payouts/commission-ledger-mutations
 */

import { getD1 } from '@/seed/db/client'

/**
 * Atomic claim: flip payable rows → paying with batch_id (C3).
 *
 * Both WHERE clauses are load-bearing, in different states:
 *
 * - `status = 'payable'` makes an Inngest retry safe — an already-claimed row
 *   is 'paying' and matches nothing.
 * - `payout_batch_id IS NULL` blocks the opposite case — a row left 'payable'
 *   while still carrying a batch id, which a run that dies after claiming but
 *   before its rollback leaves behind. Without it that row is claimable by a
 *   new batch while the original may still settle.
 *
 * The batch claim the payout cron actually runs is `claimPayableRows` in
 * `src/forest/jobs/payout-batcher/payout-batcher-claims.ts`, which carries the
 * identical guard and is the copy covered by
 * `payout-batcher-claims.test.ts`. Nothing in production calls this function.
 *
 * Returns number of rows actually claimed.
 */
export async function claimLedgerRows(
  ledgerIds: string[],
  batchId: string,
): Promise<number> {
  if (ledgerIds.length === 0) return 0
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const placeholders = ledgerIds.map(() => '?').join(',')
  const now = Math.floor(Date.now() / 1000)
  const result = await db
    .prepare(
      `UPDATE commission_ledger
       SET status = 'paying', payout_batch_id = ?, updated_at = ?
       WHERE status = 'payable' AND id IN (${placeholders}) AND payout_batch_id IS NULL`,
    )
    .bind(batchId, now, ...ledgerIds)
    .run()
  return result.meta?.changes ?? 0
}

/**
 * Mark ledger rows as paid (paying → paid) after NOWPayments confirms (C3).
 */
export async function markLedgerPaid(
  ledgerIds: string[],
  batchId: string,
): Promise<void> {
  if (ledgerIds.length === 0) return
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)
  const placeholders = ledgerIds.map(() => '?').join(',')
  await db
    .prepare(
      `UPDATE commission_ledger
       SET status = 'paid', paid_at = ?, updated_at = ?
       WHERE id IN (${placeholders}) AND status = 'paying' AND payout_batch_id = ?`,
    )
    .bind(now, now, ...ledgerIds, batchId)
    .run()
}

/**
 * Rollback paying → payable on NOWPayments failure (C3).
 * Allows next cron run to retry the same affiliate.
 */
export async function rollbackPayingRows(batchId: string): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      `UPDATE commission_ledger
       SET status = 'payable', payout_batch_id = NULL, updated_at = ?
       WHERE status = 'paying' AND payout_batch_id = ?`,
    )
    .bind(now, batchId)
    .run()
}

/**
 * Sum all paid net cents (commission - withheld) for reconciliation (C1).
 */
export async function sumPaidCommissionsCents(tenantId: string): Promise<number> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const result = await db
    .prepare(
      `SELECT COALESCE(SUM(commission_cents - withheld_cents), 0) AS total
       FROM commission_ledger
       WHERE tenant_id = ? AND status = 'paid'`,
    )
    .bind(tenantId)
    .first<{ total: number }>()
  return result?.total ?? 0
}

/**
 * Get paid batch IDs with their total cents for reconciliation diff (C1).
 */
export async function getPaidBatchSummary(
  tenantId: string,
): Promise<{ payout_batch_id: string; total_cents: number }[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const result = await db
    .prepare(
      `SELECT payout_batch_id,
              SUM(commission_cents - withheld_cents) AS total_cents
       FROM commission_ledger
       WHERE tenant_id = ? AND status = 'paid' AND payout_batch_id IS NOT NULL
       GROUP BY payout_batch_id`,
    )
    .bind(tenantId)
    .all<{ payout_batch_id: string; total_cents: number }>()
  return result.results ?? []
}
