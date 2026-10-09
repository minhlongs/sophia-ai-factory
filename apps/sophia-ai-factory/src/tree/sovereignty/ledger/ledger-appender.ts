/**
 * @file ledger-appender.ts
 * @description Insertion and sequential cryptographic chaining of compliance audit events in D1.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ComplianceAuditLog, AppendAuditInput } from './types';
import { bytesToHex } from '../cmek-envelope-engine';
import { canonicalJson, computeSovereignContentHash } from './canonical-hasher';
import { signContentHash } from './crypto-signer';

/**
 * Appends a new compliance audit event to the tamper-evident hash-chain ledger.
 */
export async function appendComplianceAuditLog(
  db: D1Database,
  input: AppendAuditInput,
): Promise<ComplianceAuditLog> {
  const timestamp = input.timestamp ?? Date.now();
  const orgId = input.orgId ?? null;
  const payload = input.payload ?? {};

  // Find the previous event's content hash
  let query = 'SELECT content_hash FROM compliance_audit_logs ';
  const bindings: unknown[] = [];

  if (orgId) {
    query += 'WHERE org_id = ?1 ORDER BY timestamp DESC, created_at DESC LIMIT 1';
    bindings.push(orgId);
  } else {
    query += 'WHERE zone_id = ?1 ORDER BY timestamp DESC, created_at DESC LIMIT 1';
    bindings.push(input.zoneId);
  }

  const latestRow = await db
    .prepare(query)
    .bind(...bindings)
    .first<{ content_hash: string }>();

  const prevHash = latestRow?.content_hash ?? null;

  // Compute the cryptographic content hash
  const contentHash = await computeSovereignContentHash({
    prevHash,
    timestamp,
    zoneId: input.zoneId,
    orgId,
    actorId: input.actorId,
    action: input.action,
    jurisdictionCompliance: input.jurisdictionCompliance,
    policyVerdict: input.policyVerdict,
    payload,
  });

  // Generate digital signature if signing secret is provided
  let digitalSignature: string | null = null;
  if (input.signingKeySecret) {
    digitalSignature = await signContentHash(contentHash, input.signingKeySecret);
  }

  const randomBytesArr = new Uint8Array(16);
  crypto.getRandomValues(randomBytesArr);
  const id = `cal_${bytesToHex(randomBytesArr)}`;
  const canonicalPayloadStr = canonicalJson(payload);

  await db
    .prepare(`
      INSERT INTO compliance_audit_logs (
        id, org_id, zone_id, actor_id, actor_type, actor_ip_hash,
        action, resource_type, resource_id, jurisdiction_compliance,
        policy_verdict, payload_canonical_json, prev_hash, content_hash,
        digital_signature, timestamp, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
    `)
    .bind(
      id,
      orgId,
      input.zoneId,
      input.actorId,
      input.actorType,
      input.actorIpHash,
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      input.jurisdictionCompliance,
      input.policyVerdict,
      canonicalPayloadStr,
      prevHash,
      contentHash,
      digitalSignature,
      timestamp,
      Date.now(),
    )
    .run();

  return {
    id,
    orgId,
    zoneId: input.zoneId,
    actorId: input.actorId,
    actorType: input.actorType,
    actorIpHash: input.actorIpHash,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    jurisdictionCompliance: input.jurisdictionCompliance,
    policyVerdict: input.policyVerdict,
    payload,
    prevHash,
    contentHash,
    digitalSignature,
    timestamp,
    createdAt: Date.now(),
  };
}
