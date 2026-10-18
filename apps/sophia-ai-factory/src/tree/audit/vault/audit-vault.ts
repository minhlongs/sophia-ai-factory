/**
 * Append-only D1 audit log transaction coordinator and recorder.
 *
 * @module tree/audit/vault/audit-vault
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseAuditEvent,
  RecordEnterpriseAuditInput,
} from '@/seed/types/enterprise-audit';
import { randomBytes } from 'node:crypto';
import { canonicalJson, computeEnterpriseContentHash } from './merkle-chain';
import {
  fetchLatestChainHash,
  insertAuditEventRow,
  mapRowToAuditEvent,
} from './audit-vault-queries';

export { mapRowToAuditEvent };

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

  const prevHash = await fetchLatestChainHash(db, orgId);

  const contentHash = computeEnterpriseContentHash(
    prevHash,
    timestamp,
    input.action,
    input.actorId,
    payload,
  );

  const event: EnterpriseAuditEvent = {
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

  await insertAuditEventRow(db, event, serializedPayload);

  return event;
}
