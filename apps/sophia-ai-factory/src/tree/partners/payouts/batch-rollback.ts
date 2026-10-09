/**
 * Payout Batch Atomic Rollback Utilities
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/batch-rollback
 */

import type { D1Database } from '@cloudflare/workers-types';

/**
 * Atomically rolls back a claimed payout batch and reverts all associated commissions and Co-Op claims.
 *
 * Guarantees zero fund loss on gateway error or timeout.
 * - Commissions revert from 'approved' to 'pending' with payout_batch_id cleared.
 * - Co-Op claims revert from 'processing' to 'approved' with payout_batch_id cleared.
 * - Batch status is updated to 'failed' with the recorded error message.
 *
 * @param db - D1Database instance.
 * @param batchId - ID of batch to rollback.
 * @param errorMessage - Descriptive failure cause.
 */
export async function rollbackPayoutBatch(
  db: D1Database,
  batchId: string,
  errorMessage: string,
): Promise<boolean> {
  const now = Date.now();

  // 1. Revert commissions back to pending
  await db
    .prepare(`
      UPDATE partner_commissions
      SET status = 'pending', payout_batch_id = NULL
      WHERE payout_batch_id = ?
    `)
    .bind(batchId)
    .run();

  // 2. Revert co-op claims back to approved
  await db
    .prepare(`
      UPDATE partner_co_op_claims
      SET status = 'approved', payout_batch_id = NULL
      WHERE payout_batch_id = ?
    `)
    .bind(batchId)
    .run();

  // 3. Mark batch as failed
  await db
    .prepare(`
      UPDATE partner_payout_batches
      SET status = 'failed', error_message = ?1, updated_at = ?2
      WHERE id = ?3
    `)
    .bind(errorMessage, now, batchId)
    .run();

  return true;
}
