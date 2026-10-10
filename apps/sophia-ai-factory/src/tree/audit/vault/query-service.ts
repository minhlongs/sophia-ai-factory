/**
 * Search and paginated query service for enterprise audit events.
 *
 * @module tree/audit/vault/query-service
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseAuditEvent,
  EnterpriseAuditRow,
  AuditFilterOptions,
} from '@/seed/types/enterprise-audit';
import { mapRowToAuditEvent } from './audit-vault';

/**
 * Searches and paginates enterprise audit events with multi-field filtering.
 */
export async function queryEnterpriseAuditEvents(
  db: D1Database,
  filters: AuditFilterOptions = {},
): Promise<{ events: EnterpriseAuditEvent[]; total: number }> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.orgId) {
    params.push(filters.orgId);
    conditions.push(`org_id = ?${params.length}`);
  }

  if (filters.action && filters.action !== 'all') {
    params.push(filters.action);
    conditions.push(`action = ?${params.length}`);
  }

  if (filters.actorId) {
    params.push(filters.actorId);
    conditions.push(`actor_id = ?${params.length}`);
  }

  if (filters.actorEmail) {
    params.push(`%${filters.actorEmail}%`);
    conditions.push(`actor_email LIKE ?${params.length}`);
  }

  if (filters.resourceType && filters.resourceType !== 'all') {
    params.push(filters.resourceType);
    conditions.push(`resource_type = ?${params.length}`);
  }

  if (typeof filters.fromTimestamp === 'number') {
    params.push(filters.fromTimestamp);
    conditions.push(`timestamp >= ?${params.length}`);
  }

  if (typeof filters.toTimestamp === 'number') {
    params.push(filters.toTimestamp);
    conditions.push(`timestamp <= ?${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM enterprise_audit_events WHERE ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = countRow?.total ?? 0;

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const queryParams = [...params, limit, offset];
  const querySql = `
    SELECT id, org_id, actor_id, actor_email, action, resource_type,
           resource_id, payload, prev_hash, content_hash, timestamp,
           ip_address, user_agent, created_at
    FROM enterprise_audit_events
    WHERE ${whereClause}
    ORDER BY timestamp DESC, created_at DESC
    LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}
  `;

  const { results } = await db.prepare(querySql).bind(...queryParams).all<EnterpriseAuditRow>();
  const events = (results || []).map(mapRowToAuditEvent);

  return { events, total };
}
