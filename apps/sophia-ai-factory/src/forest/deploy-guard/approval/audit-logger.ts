/**
 * Deploy Guard audit event logger and history query
 *
 * @module forest/deploy-guard/approval/audit-logger
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface DeployGuardAuditParams {
  approvalId: string | null;
  action: string;
  operatorId: string;
  operatorName: string;
  reason: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Log a deploy guard event to the immutable admin_audit_log table.
 */
export async function auditDeployGuardEvent(params: DeployGuardAuditParams): Promise<void> {
  const db = await getD1();
  if (!db) return;

  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    approvalId: params.approvalId,
    reason: params.reason,
    metadata: params.metadata,
  });

  try {
    await db
      .prepare(`
        INSERT INTO admin_audit_log (actor_user_id, action_type, target_user_id, payload, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        params.operatorId,
        `DEPLOY_GUARD_${params.action.toUpperCase()}`,
        params.operatorId,
        payload,
        now,
      )
      .run();
  } catch (error) {
    logger.error('Failed to write audit log', error instanceof Error ? error : { error: String(error) });
  }
}

/**
 * Query deploy guard history from admin_audit_log.
 */
export async function getDeployGuardHistory(
  limit: number = 100,
  cursor?: string,
): Promise<{ entries: Record<string, unknown>[]; nextCursor: string | null }> {
  const db = await getD1();
  if (!db) return { entries: [], nextCursor: null };

  let query = `
    SELECT id, actor_user_id, action_type, payload, created_at
    FROM admin_audit_log
    WHERE action_type LIKE 'DEPLOY_GUARD_%'
    ORDER BY id DESC
    LIMIT ?
  `;
  const params: (string | number)[] = [limit];

  if (cursor) {
    query = `
      SELECT id, actor_user_id, action_type, payload, created_at
      FROM admin_audit_log
      WHERE action_type LIKE 'DEPLOY_GUARD_%' AND id < ?
      ORDER BY id DESC
      LIMIT ?
    `;
    params.unshift(cursor, limit);
  }

  const rows = await db.prepare(query).bind(...params).all() as unknown as Array<{
    id: string;
    actor_user_id: string;
    action_type: string;
    payload: string | null;
    created_at: number;
  }>;

  const entries = rows.map((row) => {
    const action = row.action_type.replace('DEPLOY_GUARD_', '').toLowerCase();
    let payload: Record<string, unknown> = {};
    try {
      payload = row.payload ? (JSON.parse(row.payload) as Record<string, unknown>) : {};
    } catch {
      payload = {};
    }
    return {
      id: row.id,
      timestamp: row.created_at,
      action,
      commit_sha: typeof payload.commitSha === 'string' ? payload.commitSha : undefined,
      operator_id: row.actor_user_id,
      operator_name: row.actor_user_id,
      reason: typeof payload.reason === 'string' ? payload.reason : null,
      metadata: (payload.metadata as Record<string, unknown> | null) ?? null,
    };
  });

  const nextCursor = entries.length > 0 ? entries[entries.length - 1].id : null;
  return { entries, nextCursor };
}
