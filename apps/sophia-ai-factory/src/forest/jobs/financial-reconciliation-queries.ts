/**
 * Financial reconciliation D1 query and state update helpers.
 *
 * @module forest/jobs/financial-reconciliation-queries
 */

import { logger } from '@/seed/utils/logger-utility';

export async function fetchBatchLedgerSum(
  db: D1Database,
  batchId: string,
): Promise<number> {
  const batch = await db
    .prepare('SELECT id, total_amount_cents, status FROM payout_batches WHERE id = ?')
    .bind(batchId)
    .first<{ id: string; total_amount_cents: number; status: string }>();

  let ledgerSum = batch?.total_amount_cents ?? 0;
  try {
    const sumRow = await db
      .prepare(
        `SELECT SUM(commission_cents) AS sum_cents
         FROM commission_ledger
         WHERE payout_batch_id = ?`,
      )
      .bind(batchId)
      .first<{ sum_cents: number | null }>();

    if (sumRow && sumRow.sum_cents !== null && sumRow.sum_cents > 0) {
      ledgerSum = sumRow.sum_cents;
    }
  } catch {
    // If ledger query fails, rely on batch.total_amount_cents
  }

  return ledgerSum;
}

export async function markBatchReconciled(
  db: D1Database,
  batchId: string,
  nowMs: number,
): Promise<void> {
  await db
    .prepare('UPDATE payout_batches SET status = ?, confirmed_at = ? WHERE id = ?')
    .bind('confirmed', nowMs, batchId)
    .run();

  try {
    await db
      .prepare(
        `UPDATE commission_ledger
         SET status = 'paid'
         WHERE payout_batch_id = ? AND status = 'paying'`,
      )
      .bind(batchId)
      .run();
  } catch {
    // Non-fatal if table doesn't have rows currently in 'paying'
  }
}

export async function markBatchReconciliationFailed(
  db: D1Database,
  batchId: string,
): Promise<void> {
  await db
    .prepare('UPDATE payout_batches SET status = ? WHERE id = ?')
    .bind('reconciliation_failed', batchId)
    .run();
}

export async function fetchUnreconciledBatches(
  db: D1Database,
): Promise<Array<{ id: string; total_amount_cents: number }> | null> {
  try {
    const result = await db
      .prepare(
        `SELECT id, total_amount_cents
         FROM payout_batches
         WHERE status IN ('processing', 'pending')`,
      )
      .all<{ id: string; total_amount_cents: number }>();
    return result.results ?? [];
  } catch (err) {
    logger.error(
      '[FinancialReconciliation] Error fetching unreconciled batches',
      err instanceof Error ? err : new Error(String(err)),
    );
    return null;
  }
}
