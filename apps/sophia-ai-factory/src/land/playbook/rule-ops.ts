/**
 * Playbook Rule Ops — Phase 5: Auto-Creative Playbook (COMPOUND stage)
 *
 * Pure D1 counter updates for playbook rules. Placed in `land/` (same layer as
 * the caller `playbook-applier.ts`) so the module graph stays acyclic —
 * `forest` orchestrates `land`, never the reverse.
 *
 * Layer: land (business workflow)
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

/**
 * Increment `applied_count` after a successful playbook apply.
 * Non-fatal: failures are logged and the counter is best-effort.
 */
export async function recordApply(ruleId: string): Promise<void> {
  const db = createServerClient()
  try {
    await db.execute(
      `UPDATE playbook_rules SET applied_count = applied_count + 1, updated_at = ?
       WHERE id = ?`,
      [Date.now(), ruleId],
    )
  } catch (err) {
    logger.warn('[recordApply] counter update failed (non-fatal)', {
      ruleId,
      error: String(err),
    })
  }
}