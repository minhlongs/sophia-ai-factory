/**
 * Admin audit log — append-only write helper.
 * Called for every admin mutation (refunds, tier changes, credit grants, etc.).
 *
 * @module lib/admin/audit-log
 */

import { getD1Raw } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'

export type AuditActionType =
  | 'refund_approved'
  | 'refund_rejected'
  | 'refund_marked_refunded'
  | 'grant_credits'
  | 'reset_tier'
  | 'pause_user'
  | 'resume_user'
  | 'pricing_override_set'
  | 'replay_ipn'
  | 'run_synthetic'
  | 'mark_migration_applied'
  | 'synthetic_ipn'
  | 'heygen_webhook_registered'

export async function writeAuditLog(params: {
  actorUserId: string
  actionType: AuditActionType
  targetUserId?: string
  payload?: Record<string, unknown>
}): Promise<void> {
  try {
    const db = await getD1Raw()
    await db
      .prepare(
        `INSERT INTO admin_audit_log (actor_user_id, action_type, target_user_id, payload)
         VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(
        params.actorUserId,
        params.actionType,
        params.targetUserId ?? null,
        params.payload ? JSON.stringify(params.payload) : null,
      )
      .run()
  } catch (err) {
    logger.error('[AuditLog] Write failed', err instanceof Error ? err : undefined, {
      action: params.actionType,
    })
  }
}
