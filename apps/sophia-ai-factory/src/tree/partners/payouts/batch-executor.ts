/**
 * Payout Batch Execution Logic
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/batch-executor
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PartnerPayoutBatch } from '@/tree/partners/types';
import { rollbackPayoutBatch } from './batch-rollback';
import { defaultRailDispatcher } from './rail-dispatcher';
import { markBatchCompletedInDb } from './batch-completion-helper';
import type { GatewayDispatcher, PayoutBatchExecutionResult } from './types';

/**
 * Executes a payout batch via the specified payment rail and applies atomic rollback on gateway error.
 *
 * @param db - D1Database instance.
 * @param batchId - ID of payout batch to execute.
 * @param customDispatcher - Optional gateway dispatcher function for testing or production DI.
 */
export async function executePayoutBatch(
  db: D1Database,
  batchId: string,
  customDispatcher?: GatewayDispatcher,
): Promise<PayoutBatchExecutionResult> {
  const batch = await db
    .prepare('SELECT * FROM partner_payout_batches WHERE id = ?')
    .bind(batchId)
    .first<PartnerPayoutBatch>();

  if (!batch) {
    return {
      batchId,
      success: false,
      payoutRail: 'USDT',
      totalAmountCents: 0,
      totalAmountLocal: 0,
      itemCount: 0,
      error: 'PAYOUT_BATCH_NOT_FOUND',
    };
  }

  // Idempotency check: if already completed, return success
  if (batch.status === 'completed') {
    return {
      batchId,
      success: true,
      status: 'completed',
      txHash: batch.tx_hash ?? undefined,
      payoutRail: batch.payout_rail,
      totalAmountCents: batch.total_amount_cents,
      totalAmountLocal: batch.total_amount_local,
      itemCount: batch.item_count,
      externalReference: batch.external_reference ?? undefined,
    };
  }

  if (batch.status === 'failed' || batch.status === 'cancelled') {
    return {
      batchId,
      success: false,
      status: 'failed',
      payoutRail: batch.payout_rail,
      totalAmountCents: batch.total_amount_cents,
      totalAmountLocal: batch.total_amount_local,
      itemCount: batch.item_count,
      error: `BATCH_INELIGIBLE_FOR_EXECUTION: status=${batch.status}`,
    };
  }

  const now = Date.now();

  // Mark batch as processing
  await db
    .prepare("UPDATE partner_payout_batches SET status = 'processing', executed_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, batchId)
    .run();

  try {
    const dispatcher = customDispatcher ?? defaultRailDispatcher;
    const dispatchResult = await dispatcher(batch);

    if (!dispatchResult.success) {
      const errorMsg = dispatchResult.error ?? 'PAYMENT_GATEWAY_FAILURE';
      await rollbackPayoutBatch(db, batchId, errorMsg);
      return {
        batchId,
        success: false,
        payoutRail: batch.payout_rail,
        totalAmountCents: batch.total_amount_cents,
        totalAmountLocal: batch.total_amount_local,
        itemCount: batch.item_count,
        error: errorMsg,
      };
    }

    return await markBatchCompletedInDb(db, batch, dispatchResult);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await rollbackPayoutBatch(db, batchId, errorMsg);
    return {
      batchId,
      success: false,
      status: 'failed',
      payoutRail: batch.payout_rail,
      totalAmountCents: batch.total_amount_cents,
      totalAmountLocal: batch.total_amount_local,
      itemCount: batch.item_count,
      error: errorMsg,
    };
  }
}
