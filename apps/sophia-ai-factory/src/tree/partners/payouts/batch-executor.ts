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

    const completedAt = Date.now();
    const externalRef = dispatchResult.externalReference ?? null;
    const txHash = dispatchResult.txHash ?? null;
    const rawJson = JSON.stringify(dispatchResult.rawResponse ?? {});

    // Transition batch to completed
    await db
      .prepare(`
        UPDATE partner_payout_batches
        SET status = 'completed',
            external_reference = ?1,
            tx_hash = ?2,
            raw_response_json = ?3,
            completed_at = ?4,
            updated_at = ?4
        WHERE id = ?5
      `)
      .bind(externalRef, txHash, rawJson, completedAt, batchId)
      .run();

    // Mark all linked commissions as paid
    await db
      .prepare("UPDATE partner_commissions SET status = 'paid' WHERE payout_batch_id = ?")
      .bind(batchId)
      .run();

    // Mark all linked co-op claims as paid
    await db
      .prepare("UPDATE partner_co_op_claims SET status = 'paid', paid_at = ? WHERE payout_batch_id = ?")
      .bind(completedAt, batchId)
      .run();

    // If batch was partner-scoped, update lifetime earnings and pending payout in partner_profiles
    if (batch.partner_id) {
      await db
        .prepare(`
          UPDATE partner_profiles
          SET total_earnings_cents = total_earnings_cents + ?1,
              pending_payout_cents = MAX(0, pending_payout_cents - ?1),
              updated_at = ?2
          WHERE id = ?3
        `)
        .bind(batch.total_amount_cents, completedAt, batch.partner_id)
        .run();
    }

    return {
      batchId,
      success: true,
      status: 'completed',
      txHash: txHash ?? undefined,
      payoutRail: batch.payout_rail,
      totalAmountCents: batch.total_amount_cents,
      totalAmountLocal: batch.total_amount_local,
      itemCount: batch.item_count,
      externalReference: externalRef ?? undefined,
    };
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
