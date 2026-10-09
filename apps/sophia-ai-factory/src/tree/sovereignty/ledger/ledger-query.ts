/**
 * @file ledger-query.ts
 * @description Filtered, paginated queries against the sovereign compliance audit log ledger.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  ComplianceAuditLog,
  ActorType,
  RegulatoryFramework,
  PolicyVerdict,
  AuditQueryFilters,
} from './types';

/**
 * Queries compliance audit logs with filtering and pagination.
 */
export async function queryComplianceAuditLogs(
  db: D1Database,
  filters: AuditQueryFilters = {},
): Promise<{ logs: ComplianceAuditLog[]; total: number }> {
  const whereClauses: string[] = [];
  const bindings: unknown[] = [];

  if (filters.orgId !== undefined) {
    if (filters.orgId === null) {
      whereClauses.push('org_id IS NULL');
    } else {
      whereClauses.push('org_id = ?' + (bindings.length + 1));
      bindings.push(filters.orgId);
    }
  }

  if (filters.zoneId) {
    whereClauses.push('zone_id = ?' + (bindings.length + 1));
    bindings.push(filters.zoneId);
  }

  if (filters.actorId) {
    whereClauses.push('actor_id = ?' + (bindings.length + 1));
    bindings.push(filters.actorId);
  }

  if (filters.action) {
    whereClauses.push('action = ?' + (bindings.length + 1));
    bindings.push(filters.action);
  }

  if (filters.policyVerdict) {
    whereClauses.push('policy_verdict = ?' + (bindings.length + 1));
    bindings.push(filters.policyVerdict);
  }

  if (filters.jurisdictionCompliance) {
    whereClauses.push('jurisdiction_compliance = ?' + (bindings.length + 1));
    bindings.push(filters.jurisdictionCompliance);
  }

  if (filters.fromTimestamp) {
    whereClauses.push('timestamp >= ?' + (bindings.length + 1));
    bindings.push(filters.fromTimestamp);
  }

  if (filters.toTimestamp) {
    whereClauses.push('timestamp <= ?' + (bindings.length + 1));
    bindings.push(filters.toTimestamp);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count
  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM compliance_audit_logs ${whereSql}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const total = Number(countRow?.total ?? 0);

  // Get records with pagination
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const dataQuery = `SELECT * FROM compliance_audit_logs ${whereSql} ORDER BY timestamp DESC LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`;
  bindings.push(limit, offset);

  const { results } = await db
    .prepare(dataQuery)
    .bind(...bindings)
    .all<Record<string, unknown>>();

  const logs = (results || []).map((row) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(String(row.payload_canonical_json || '{}'));
    } catch {
      payload = {};
    }

    return {
      id: String(row.id),
      orgId: row.org_id ? String(row.org_id) : null,
      zoneId: String(row.zone_id),
      actorId: String(row.actor_id),
      actorType: row.actor_type as ActorType,
      actorIpHash: String(row.actor_ip_hash),
      action: String(row.action),
      resourceType: String(row.resource_type),
      resourceId: row.resource_id ? String(row.resource_id) : null,
      jurisdictionCompliance: row.jurisdiction_compliance as RegulatoryFramework | 'GLOBAL',
      policyVerdict: row.policy_verdict as PolicyVerdict,
      payload,
      prevHash: row.prev_hash ? String(row.prev_hash) : null,
      contentHash: String(row.content_hash),
      digitalSignature: row.digital_signature ? String(row.digital_signature) : null,
      timestamp: Number(row.timestamp),
      createdAt: Number(row.created_at),
    };
  });

  return { logs, total };
}
