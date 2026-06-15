/**
 * Admin audit log — append-only write helper.
 * Called for every admin mutation (refunds, tier changes, credit grants, etc.).
 *
 * @module lib/admin/audit-log
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

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
  | 'customer_handover_created'
  | 'customer_handover_resent'
  | 'customer_handover_status_changed'
  | 'customer_handover_consumed'
  | 'customer_handover_session_created'
  | 'customer_handover_self_resend'

export async function writeAuditLog(params: {
  actorUserId: string
  actionType: AuditActionType
  targetUserId?: string
  payload?: Record<string, unknown>
}): Promise<void> {
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
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
