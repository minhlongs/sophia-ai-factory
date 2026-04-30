/**
 * Commission Ledger Mutations — atomic status transitions + reconciliation queries
 *
 * Separated from commission-ledger.ts for file-size compliance (<200 lines).
 * All amounts in INTEGER cents (C1).
 *
 * @module payouts/commission-ledger-mutations
 */

import { getD1Raw } from '@/lib/db/client'

/**
 * Atomic claim: flip payable rows → paying with batch_id (C3).
 * WHERE payout_batch_id IS NULL prevents double-claim on Inngest retry.
 * Returns number of rows actually claimed.
 */
export async function claimLedgerRows(
  ledgerIds: string[],
  batchId: string,
): Promise<number> {
  if (ledgerIds.length === 0) return 0
  const db = await getD1Raw()
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
  const db = await getD1Raw()
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
  const db = await getD1Raw()
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
  const db = await getD1Raw()
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
  const db = await getD1Raw()
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
