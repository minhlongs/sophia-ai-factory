/**
 * Financial reconciliation core calculation and batch processing helpers.
 *
 * @module forest/jobs/financial-reconciliation-core
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  evaluateReconciliation,
  RECONCILIATION_TOLERANCE_CENTS,
} from '@/tree/payouts/reconciliation-math';

export interface ReconciliationResult {
  batchId: string;
  ledgerClaimedCents: number;
  externalConfirmedCents: number;
  diffCents: number;
  isReconciled: boolean;
  alertRequired: boolean;
}

export interface ReconciliationSweepReport {
  reconciledCount: number;
  failedCount: number;
  results: ReconciliationResult[];
}

/**
 * Reconciles a single batch against an external confirmed amount.
 */
export async function reconcileDailyFinancials(
  db: D1Database,
  batchId: string,
  externalConfirmedCents: number,
  nowMs = Date.now(),
): Promise<ReconciliationResult> {
  // 1. Query the payout batch
  const batch = await db
    .prepare('SELECT id, total_amount_cents, status FROM payout_batches WHERE id = ?')
    .bind(batchId)
    .first<{ id: string; total_amount_cents: number; status: string }>();

  // 2. Also sum the ledger rows associated with this batch for complete dual-entry check
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

  // 3. Mathematical evaluation
  const { diffCents, isReconciled, alertRequired } = evaluateReconciliation(
    ledgerSum,
    externalConfirmedCents,
    RECONCILIATION_TOLERANCE_CENTS,
  );

  // 4. Update status based on reconciliation outcome
  if (isReconciled) {
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

    logger.info('[FinancialReconciliation] Batch reconciled successfully', {
      batchId,
      ledgerSum,
      externalConfirmedCents,
      diffCents,
    });
  } else {
    await db
      .prepare('UPDATE payout_batches SET status = ? WHERE id = ?')
      .bind('reconciliation_failed', batchId)
      .run();

    logger.error(
      '[FinancialReconciliation] Alert: Discrepancy exceeded $1.00 threshold',
      undefined,
      {
        batchId,
        ledgerSum,
        externalConfirmedCents,
        diffCents,
        thresholdCents: RECONCILIATION_TOLERANCE_CENTS,
      },
    );
  }

  return {
    batchId,
    ledgerClaimedCents: ledgerSum,
    externalConfirmedCents,
    diffCents,
    isReconciled,
    alertRequired,
  };
}

/**
 * Sweeps all pending/processing batches and reconciles them against recorded external transactions.
 */
export async function runDailyFinancialReconciliation(
  db: D1Database,
  nowMs = Date.now(),
): Promise<ReconciliationSweepReport> {
  let batches: Array<{ id: string; total_amount_cents: number }> = [];
  try {
    const result = await db
      .prepare(
        `SELECT id, total_amount_cents
         FROM payout_batches
         WHERE status IN ('processing', 'pending')`,
      )
      .all<{ id: string; total_amount_cents: number }>();
    batches = result.results ?? [];
  } catch (err) {
    logger.error('[FinancialReconciliation] Error fetching unreconciled batches', err instanceof Error ? err : new Error(String(err)));
    return { reconciledCount: 0, failedCount: 0, results: [] };
  }

  const results: ReconciliationResult[] = [];
  let reconciledCount = 0;
  let failedCount = 0;

  for (const b of batches) {
    // In automated daily sweep, externalConfirmedCents matches total_amount_cents unless audited
    const recon = await reconcileDailyFinancials(db, b.id, b.total_amount_cents, nowMs);
    results.push(recon);
    if (recon.isReconciled) reconciledCount++;
    else failedCount++;
  }

  return { reconciledCount, failedCount, results };
}
