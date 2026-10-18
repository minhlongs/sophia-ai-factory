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
import {
  fetchBatchLedgerSum,
  markBatchReconciled,
  markBatchReconciliationFailed,
  fetchUnreconciledBatches,
} from './financial-reconciliation-queries';

export {
  fetchBatchLedgerSum,
  markBatchReconciled,
  markBatchReconciliationFailed,
  fetchUnreconciledBatches,
};

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
  const ledgerSum = await fetchBatchLedgerSum(db, batchId);

  const { diffCents, isReconciled, alertRequired } = evaluateReconciliation(
    ledgerSum,
    externalConfirmedCents,
    RECONCILIATION_TOLERANCE_CENTS,
  );

  if (isReconciled) {
    await markBatchReconciled(db, batchId, nowMs);

    logger.info('[FinancialReconciliation] Batch reconciled successfully', {
      batchId,
      ledgerSum,
      externalConfirmedCents,
      diffCents,
    });
  } else {
    await markBatchReconciliationFailed(db, batchId);

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
  const batches = await fetchUnreconciledBatches(db);
  if (!batches) {
    return { reconciledCount: 0, failedCount: 0, results: [] };
  }

  const results: ReconciliationResult[] = [];
  let reconciledCount = 0;
  let failedCount = 0;

  for (const b of batches) {
    const recon = await reconcileDailyFinancials(db, b.id, b.total_amount_cents, nowMs);
    results.push(recon);
    if (recon.isReconciled) reconciledCount++;
    else failedCount++;
  }

  return { reconciledCount, failedCount, results };
}
