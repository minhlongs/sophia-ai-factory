/**
 * Automated Banking Statement Reconciliation Engine
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/banking-reconciliation-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CrossBorderClearingBatchRow,
  ReconcileBatchInput,
  ReconciliationResult,
} from '@/seed/types/multi-asset-clearing';
import { rowToCrossBorderClearingBatch } from '@/seed/types/multi-asset-clearing';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Reconciles an internal clearing batch against an external bank statement or payment rail feed.
 */
export async function reconcileBatchWithBankStatement(
  db: D1Database,
  input: ReconcileBatchInput
): Promise<ReconciliationResult> {
  const { batchReference, settledAmount, settledCurrency } = input;
  const now = Date.now();

  const batchRow = await db
    .prepare('SELECT * FROM cross_border_clearing_batches WHERE batch_reference = ?')
    .bind(batchReference)
    .first<CrossBorderClearingBatchRow>();

  if (!batchRow) {
    return {
      success: false,
      batchReference,
      previousStatus: 'pending',
      newStatus: 'pending',
      matched: false,
      reconciledAt: now,
      error: 'BATCH_NOT_FOUND',
    };
  }

  const batch = rowToCrossBorderClearingBatch(batchRow);
  const delta = Math.abs(batch.netClearedAmount - settledAmount);
  const currencyMatched = batch.targetAsset === settledCurrency;
  const amountMatched = delta <= 0.01;

  if (currencyMatched && amountMatched) {
    await db
      .prepare(
        `UPDATE cross_border_clearing_batches
         SET reconciliation_status = 'matched',
             status = 'reconciled',
             banking_partner_ref = COALESCE(banking_partner_ref, ?),
             reconciled_at = ?,
             updated_at = ?
         WHERE batch_reference = ?`
      )
      .bind(input.externalStatementRef, now, now, batchReference)
      .run();

    logger.info('Banking reconciliation matched', {
      batchReference,
      externalRef: input.externalStatementRef,
      settledAmount,
    });

    return {
      success: true,
      batchReference,
      previousStatus: batch.reconciliationStatus,
      newStatus: 'matched',
      matched: true,
      reconciledAt: now,
    };
  }

  // Mismatch detected
  await db
    .prepare(
      `UPDATE cross_border_clearing_batches
       SET reconciliation_status = 'discrepancy',
           updated_at = ?
       WHERE batch_reference = ?`
    )
    .bind(now, batchReference)
    .run();

  logger.warn('Banking reconciliation discrepancy detected', {
    batchReference,
    expectedAmount: batch.netClearedAmount,
    actualAmount: settledAmount,
    currencyExpected: batch.targetAsset,
    currencyActual: settledCurrency,
    delta,
  });

  return {
    success: false,
    batchReference,
    previousStatus: batch.reconciliationStatus,
    newStatus: 'discrepancy',
    discrepancyDelta: delta,
    matched: false,
    reconciledAt: now,
    error: `DISCREPANCY: Expected ${batch.netClearedAmount} ${batch.targetAsset}, received ${settledAmount} ${settledCurrency}`,
  };
}
