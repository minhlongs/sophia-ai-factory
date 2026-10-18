/**
 * Payout Batch Settlement Persistence Helper
 *
 * Layer: tree/partners/payouts
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PartnerPayoutBatch } from '@/tree/partners/types';
import type { PayoutBatchExecutionResult } from './types';

export interface GatewaySuccessDetails {
  externalReference?: string;
  txHash?: string;
  rawResponse?: unknown;
}

/**
 * Marks batch, linked commissions, co-op claims, and partner profile as settled in D1.
 */
export async function markBatchCompletedInDb(
  db: D1Database,
  batch: PartnerPayoutBatch,
  dispatchResult: GatewaySuccessDetails,
): Promise<PayoutBatchExecutionResult> {
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
    .bind(externalRef, txHash, rawJson, completedAt, batch.id)
    .run();

  // Mark all linked commissions as paid
  await db
    .prepare("UPDATE partner_commissions SET status = 'paid' WHERE payout_batch_id = ?")
    .bind(batch.id)
    .run();

  // Mark all linked co-op claims as paid
  await db
    .prepare("UPDATE partner_co_op_claims SET status = 'paid', paid_at = ? WHERE payout_batch_id = ?")
    .bind(completedAt, batch.id)
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
    batchId: batch.id,
    success: true,
    status: 'completed',
    txHash: txHash ?? undefined,
    payoutRail: batch.payout_rail,
    totalAmountCents: batch.total_amount_cents,
    totalAmountLocal: batch.total_amount_local,
    itemCount: batch.item_count,
    externalReference: externalRef ?? undefined,
  };
}
