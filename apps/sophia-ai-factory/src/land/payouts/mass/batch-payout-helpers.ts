/**
 * Helper to record failed payout batch status in D1 without masking the API error.
 * @module land/payouts/mass/batch-payout-helpers
 */

import type { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export async function markBatchFailedAndLog(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  batchId: string,
  safeMsg: string,
): Promise<void> {
  try {
    await db
      .prepare(
        `UPDATE payout_batches SET status = 'failed', failed_reason = ? WHERE id = ?`,
      )
      .bind(safeMsg, batchId)
      .run();
    logger.error('[NOWPayments] Mass payout failed — status updated to failed', undefined, {
      batchId,
      error: safeMsg,
    });
  } catch (updateErr) {
    logger.error('[NOWPayments] Failed to update payout_batches status after API error', undefined, {
      batchId,
      updateError: String(updateErr),
    });
  }
}
