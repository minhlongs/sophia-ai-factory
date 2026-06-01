/**
 * Cleanup synthetic artifacts created by the smoke-one-time cron.
 * Removes the videos row and user_purchases row so they don't pollute
 * production data. Idempotent — safe to call even if rows are absent.
 *
 * @module lib/monitoring/synthetic-cleanup
 */

import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'

/**
 * Delete synthetic purchase + video rows by purchase ID.
 * Errors are caught and logged — never throws.
 */
export async function cleanupSyntheticArtifacts(purchaseId: string): Promise<void> {
  try {
    const db = await getD1Raw()

    // Delete videos rows linked to this purchase (there may be 0 or 1)
    await db
      .prepare('DELETE FROM videos WHERE purchase_id = ?1')
      .bind(purchaseId)
      .run()

    // Delete the synthetic purchase row itself
    await db
      .prepare('DELETE FROM user_purchases WHERE id = ?1')
      .bind(purchaseId)
      .run()

    logger.info('[SyntheticCleanup] Removed synthetic artifacts', { purchaseId })
  } catch (err) {
    logger.warn('[SyntheticCleanup] Cleanup failed (non-fatal)', {
      purchaseId,
      error: getErrorMessage(err),
    })
  }
}
