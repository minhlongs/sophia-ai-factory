/**
 * Append-only D1 audit log transaction coordinator and recorder.
 *
 * @module tree/audit/vault/audit-vault
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseAuditEvent,
  EnterpriseAuditRow,
  RecordEnterpriseAuditInput,
} from '@/seed/types/enterprise-audit';
import { randomBytes } from 'node:crypto';
import { canonicalJson, computeEnterpriseContentHash } from './merkle-chain';

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

/**
 * Atomically records an enterprise audit event into the cryptographic hash-chain.
 * Resolves the previous hash in the chain and computes content_hash deterministically.
 */
export async function recordEnterpriseAuditEvent(
  db: D1Database,
  input: RecordEnterpriseAuditInput,
): Promise<EnterpriseAuditEvent> {
  const orgId = input.orgId ?? null;
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const now = Math.floor(Date.now() / 1000);
  const id = randomBytes(16).toString('hex');
  const payload = input.payload ?? {};
  const serializedPayload = canonicalJson(payload);

  // 1. Fetch latest event in this organization's chain (or global chain if orgId is null)
  let latestRow: { content_hash: string } | null = null;
  if (orgId) {
    latestRow = await db
      .prepare(
        `SELECT content_hash
         FROM enterprise_audit_events
         WHERE org_id = ?1
         ORDER BY timestamp DESC, created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .bind(orgId)
      .first<{ content_hash: string }>();
  } else {
    latestRow = await db
      .prepare(
        `SELECT content_hash
         FROM enterprise_audit_events
         WHERE org_id IS NULL
         ORDER BY timestamp DESC, created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .bind(orgId)
      .first<{ content_hash: string }>();
  }

  const prevHash = latestRow ? latestRow.content_hash : null;

  // 2. Compute canonical content hash
  const contentHash = computeEnterpriseContentHash(
    prevHash,
    timestamp,
    input.action,
    input.actorId,
    payload,
  );

  // 3. Insert record into D1
  await db
    .prepare(
      `INSERT INTO enterprise_audit_events (
        id, org_id, actor_id, actor_email, action, resource_type,
        resource_id, payload, prev_hash, content_hash, timestamp,
        ip_address, user_agent, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
    )
    .bind(
      id,
      orgId,
      input.actorId,
      input.actorEmail ?? null,
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      serializedPayload,
      prevHash,
      contentHash,
      timestamp,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      now,
    )
    .run();

  return {
    id,
    orgId,
    actorId: input.actorId,
    actorEmail: input.actorEmail ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    payload,
    prevHash,
    contentHash,
    timestamp,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: now,
  };
}
