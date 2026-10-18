/**
 * Customer handover milestone stamps (first SOP run and first SOP install).
 *
 * @module tree/handover/handover-milestones
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Stamp customer_first_run_at exactly once. Idempotent — subsequent calls
 * are no-ops thanks to COALESCE. Call from anywhere a customer runs a SOP.
 */
export async function markFirstRun(customerUserId: string): Promise<void> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `UPDATE customer_handovers
         SET customer_first_run_at = COALESCE(customer_first_run_at, ?1)
         WHERE customer_user_id = ?2`,
      )
      .bind(now, customerUserId)
      .run();
  } catch (err) {
    // Non-fatal — should never block a SOP run
    logger.warn('[MagicLink] markFirstRun failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Stamp customer_first_sop_install_at exactly once for a customer.
 */
export async function markFirstSopInstall(customerUserId: string): Promise<void> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `UPDATE customer_handovers
         SET customer_first_sop_install_at = COALESCE(customer_first_sop_install_at, ?1)
         WHERE customer_user_id = ?2`,
      )
      .bind(now, customerUserId)
      .run();
  } catch (err) {
    logger.warn('[MagicLink] markFirstSopInstall failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
