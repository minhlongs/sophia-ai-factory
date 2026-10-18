/**
 * Audit log search primitive — read-only access to `audit_log`.
 *
 * Supports optional tenantId / action filters + time window + pagination.
 * Indexed via `idx_audit_tenant_ts` and `idx_audit_action_ts` so common queries
 * stay cheap.
 *
 * Used by admin /dashboard/admin/audit-log + /api/admin/audit-log.
 *
 * @module land/observability/audit-log-stats
 */

import { getD1 } from '@/seed/db/client';
import { parseMetadata } from './audit-log-stats-helpers';

export { getTopActions, type ActionFrequency } from './audit-log-stats-helpers';

export interface AuditLogRow {
  id: number;
  tenantId: string;
  actor: string;
  action: string;
  resource: string | null;
  metadata: Record<string, unknown> | null;
  ts: number;
}

export interface AuditSearchInput {
  tenantId?: string;
  action?: string;
  /** Inclusive unix seconds. */
  fromTs?: number;
  /** Inclusive unix seconds. */
  toTs?: number;
  /** 1–500, default 100. */
  limit?: number;
  /** ≥0, default 0. */
  offset?: number;
}

interface RawRow {
  id: number;
  tenant_id: string;
  actor: string;
  action: string;
  resource: string | null;
  metadata_json: string | null;
  ts: number;
}

/**
 * Search audit_log; newest first. Filters compose with AND.
 * Time window is open at both ends if not provided.
 */
export async function searchAuditLog(input: AuditSearchInput): Promise<AuditLogRow[]> {
  const limit = Math.max(1, Math.min(500, Math.floor(input.limit ?? 100)));
  const offset = Math.max(0, Math.floor(input.offset ?? 0));

  const where: string[] = [];
  const binds: unknown[] = [];
  if (input.tenantId) {
    where.push(`tenant_id = ?`);
    binds.push(input.tenantId);
  }
  if (input.action) {
    where.push(`action = ?`);
    binds.push(input.action);
  }
  if (input.fromTs !== undefined) {
    where.push(`ts >= ?`);
    binds.push(input.fromTs);
  }
  if (input.toTs !== undefined) {
    where.push(`ts <= ?`);
    binds.push(input.toTs);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT id, tenant_id, actor, action, resource, metadata_json, ts
               FROM audit_log
               ${whereSql}
               ORDER BY ts DESC
               LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const result = await db.prepare(sql).bind(...binds).all<RawRow>();
  return (result.results ?? []).map((r) => ({
    id: Number(r.id),
    tenantId: r.tenant_id,
    actor: r.actor,
    action: r.action,
    resource: r.resource,
    metadata: parseMetadata(r.metadata_json),
    ts: Number(r.ts),
  }));
}
