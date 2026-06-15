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

import { getD1Raw } from '@/seed/db/client';

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

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
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

  const db = await getD1Raw();
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

export interface ActionFrequency {
  action: string;
  count: number;
}

/**
 * Top-N most frequent actions within a window — useful for sanity-checking
 * what's flowing through the audit pipe.
 */
export async function getTopActions(
  fromTs: number,
  toTs: number,
  limit: number = 20,
): Promise<ActionFrequency[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const db = await getD1Raw();
  const result = await db
    .prepare(
      `SELECT action, COUNT(*) AS n
       FROM audit_log
       WHERE ts >= ?1 AND ts <= ?2
       GROUP BY action
       ORDER BY n DESC
       LIMIT ?3`,
    )
    .bind(fromTs, toTs, safeLimit)
    .all<{ action: string; n: number }>();
  return (result.results ?? []).map((r) => ({
    action: r.action,
    count: Number(r.n),
  }));
}
