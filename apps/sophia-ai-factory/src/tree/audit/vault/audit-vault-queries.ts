/**
 * D1 row mappers and SQL queries for the Enterprise Audit Vault.
 *
 * @module tree/audit/vault/audit-vault-queries
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseAuditEvent,
  EnterpriseAuditRow,
} from '@/seed/types/enterprise-audit';

export function mapRowToAuditEvent(row: EnterpriseAuditRow): EnterpriseAuditEvent {
  let parsedPayload: Record<string, unknown> = {};
  try {
    parsedPayload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    parsedPayload = { _raw: row.payload };
  }

  return {
    id: row.id,
    orgId: row.org_id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    payload: parsedPayload,
    prevHash: row.prev_hash,
    contentHash: row.content_hash,
    timestamp: row.timestamp,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

export async function fetchLatestChainHash(
  db: D1Database,
  orgId: string | null,
): Promise<string | null> {
  if (orgId) {
    const latestRow = await db
      .prepare(
        `SELECT content_hash
         FROM enterprise_audit_events
         WHERE org_id = ?1
         ORDER BY timestamp DESC, created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .bind(orgId)
      .first<{ content_hash: string }>();
    return latestRow ? latestRow.content_hash : null;
  }

  const latestRow = await db
    .prepare(
      `SELECT content_hash
       FROM enterprise_audit_events
       WHERE org_id IS NULL
       ORDER BY timestamp DESC, created_at DESC, rowid DESC
       LIMIT 1`,
    )
    .bind(orgId)
    .first<{ content_hash: string }>();
  return latestRow ? latestRow.content_hash : null;
}

export async function insertAuditEventRow(
  db: D1Database,
  event: EnterpriseAuditEvent,
  serializedPayload: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO enterprise_audit_events (
        id, org_id, actor_id, actor_email, action, resource_type,
        resource_id, payload, prev_hash, content_hash, timestamp,
        ip_address, user_agent, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
    )
    .bind(
      event.id,
      event.orgId,
      event.actorId,
      event.actorEmail,
      event.action,
      event.resourceType,
      event.resourceId,
      serializedPayload,
      event.prevHash,
      event.contentHash,
      event.timestamp,
      event.ipAddress,
      event.userAgent,
      event.createdAt,
    )
    .run();
}
