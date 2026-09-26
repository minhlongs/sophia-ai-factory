/**
 * Sovereign Compliance Ledger & Cryptographic Hash-Chain Audit Vault
 *
 * Implements a tamper-evident, verifiable hash-chained audit ledger
 * for multi-jurisdiction data sovereignty compliance:
 *
 *   content_hash = sha256(prev_hash | timestamp | zone_id | org_id | actor_id | action | jurisdiction | verdict | canonical_payload)
 *
 * Every compliance decision (access grant, cross-border transfer, CMEK rotation,
 * crypto-shredding, erasure certificate) is sequentially linked into the hash chain.
 *
 * Layer: tree (Domain logic & cryptographic audit verification)
 * Allowed imports: @/seed/*, standard Web Crypto APIs
 *
 * @module tree/sovereignty/compliance-ledger
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  ComplianceAuditLog,
  RegulatoryFramework,
  PolicyVerdict,
  ActorType,
  ChainVerificationResult,
} from '@/seed/types/sovereign-vault';
import { bytesToHex } from './cmek-envelope-engine';

export interface AppendAuditInput {
  orgId?: string | null;
  zoneId: string;
  actorId: string;
  actorType: ActorType;
  actorIpHash: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  jurisdictionCompliance: RegulatoryFramework | 'GLOBAL';
  policyVerdict: PolicyVerdict;
  payload?: Record<string, unknown>;
  timestamp?: number;
  signingKeySecret?: string;
}

export interface AuditQueryFilters {
  orgId?: string | null;
  zoneId?: string;
  actorId?: string;
  action?: string;
  policyVerdict?: PolicyVerdict;
  jurisdictionCompliance?: RegulatoryFramework | 'GLOBAL';
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

// ── Canonical Serialization & Hashing ─────────────────────────────────────────

/**
 * Deterministically serializes an arbitrary JSON object with recursively sorted keys.
 * Guarantees bit-identical canonical serialization across different environments.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalJson(item));
    return `[${items.join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);

  return `{${pairs.join(',')}}`;
}

/**
 * Computes the cryptographic SHA-256 content hash for a compliance audit record.
 */
export async function computeSovereignContentHash(params: {
  prevHash: string | null;
  timestamp: number;
  zoneId: string;
  orgId: string | null;
  actorId: string;
  action: string;
  jurisdictionCompliance: string;
  policyVerdict: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const normalizedPrev = params.prevHash || 'GENESIS';
  const canonicalPayload = canonicalJson(params.payload || {});
  const data = [
    normalizedPrev,
    String(params.timestamp),
    params.zoneId,
    params.orgId || 'GLOBAL_ORG',
    params.actorId,
    params.action,
    params.jurisdictionCompliance,
    params.policyVerdict,
    canonicalPayload,
  ].join('|');

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Generates an HMAC-SHA256 signature over the content hash using a compliance signing key.
 */
export async function signContentHash(contentHash: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(contentHash));
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Verifies an HMAC-SHA256 signature against the expected content hash.
 */
export async function verifySignature(
  contentHash: string,
  signatureHex: string,
  secret: string,
): Promise<boolean> {
  try {
    const expectedSig = await signContentHash(contentHash, secret);
    return expectedSig.toLowerCase() === signatureHex.toLowerCase();
  } catch {
    return false;
  }
}

// ── Database Operations ───────────────────────────────────────────────────────

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

interface RowVerificationResult {
  isValid: boolean;
  error?: string;
  recomputedHash?: string;
}

function checkPrevHashLink(
  index: number,
  rowPrevHash: string | null,
  previousCalculatedHash: string | null,
): { valid: boolean; error?: string } {
  if (index === 0) {
    const isGenesis = rowPrevHash === null || rowPrevHash === 'GENESIS';
    if (!isGenesis && previousCalculatedHash && rowPrevHash !== previousCalculatedHash) {
      return {
        valid: false,
        error: `Broken hash chain at genesis: expected null or GENESIS, got ${rowPrevHash}`,
      };
    }
    return { valid: true };
  }

  if (rowPrevHash !== previousCalculatedHash) {
    return {
      valid: false,
      error: `Broken chain link at index ${index}: prev_hash (${rowPrevHash}) does not match previous content_hash (${previousCalculatedHash})`,
    };
  }

  return { valid: true };
}

async function verifySingleChainRow(
  row: Record<string, unknown>,
  index: number,
  previousCalculatedHash: string | null,
  signingKeySecret?: string,
): Promise<RowVerificationResult> {
  const rowId = String(row.id);
  const rowPrevHash = row.prev_hash ? String(row.prev_hash) : null;
  const rowContentHash = String(row.content_hash);
  const rowTimestamp = Number(row.timestamp);
  const rowZoneId = String(row.zone_id);
  const rowOrgId = row.org_id ? String(row.org_id) : null;
  const rowActorId = String(row.actor_id);
  const rowAction = String(row.action);
  const rowJurisdiction = String(row.jurisdiction_compliance);
  const rowVerdict = String(row.policy_verdict);

  let parsedPayload: Record<string, unknown> = {};
  try {
    parsedPayload = JSON.parse(String(row.payload_canonical_json || '{}'));
  } catch {
    return {
      isValid: false,
      error: `Invalid canonical JSON payload in event ${rowId}`,
    };
  }

  // 1. Verify backward link to previous hash
  const linkCheck = checkPrevHashLink(index, rowPrevHash, previousCalculatedHash);
  if (!linkCheck.valid) {
    return { isValid: false, error: linkCheck.error };
  }

  // 2. Recompute content hash from raw record fields
  const recomputedHash = await computeSovereignContentHash({
    prevHash: rowPrevHash,
    timestamp: rowTimestamp,
    zoneId: rowZoneId,
    orgId: rowOrgId,
    actorId: rowActorId,
    action: rowAction,
    jurisdictionCompliance: rowJurisdiction,
    policyVerdict: rowVerdict,
    payload: parsedPayload,
  });

  if (recomputedHash !== rowContentHash) {
    return {
      isValid: false,
      error: `Content hash mismatch at index ${index}: stored (${rowContentHash}) != recomputed (${recomputedHash}). Data has been tampered with.`,
    };
  }

  // 3. Verify digital signature if secret provided
  if (signingKeySecret && row.digital_signature) {
    const sigValid = await verifySignature(
      rowContentHash,
      String(row.digital_signature),
      signingKeySecret,
    );
    if (!sigValid) {
      return {
        isValid: false,
        error: `Invalid digital signature for event ${rowId}`,
      };
    }
  }

  return { isValid: true, recomputedHash };
}

/**
 * Traverses and verifies the entire cryptographic hash-chain for an organization or zone.
 * Detects any data tampering, payload modification, or missing/injected records.
 */
export async function verifyComplianceAuditChain(
  db: D1Database,
  options: {
    orgId?: string | null;
    zoneId?: string;
    signingKeySecret?: string;
    limit?: number;
  } = {},
): Promise<ChainVerificationResult> {
  let query = 'SELECT * FROM compliance_audit_logs';
  const bindings: unknown[] = [];
  const whereClauses: string[] = [];

  if (options.orgId) {
    whereClauses.push('org_id = ?' + (bindings.length + 1));
    bindings.push(options.orgId);
  } else if (options.zoneId) {
    whereClauses.push('zone_id = ?' + (bindings.length + 1));
    bindings.push(options.zoneId);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY timestamp ASC, created_at ASC, id ASC';

  if (options.limit) {
    query += ' LIMIT ?' + (bindings.length + 1);
    bindings.push(options.limit);
  }

  const { results } = await db
    .prepare(query)
    .bind(...bindings)
    .all<Record<string, unknown>>();

  const rows = results || [];
  if (rows.length === 0) {
    return {
      isValid: true,
      checkedCount: 0,
      genesisHash: undefined,
      latestHash: undefined,
    };
  }

  let previousCalculatedHash: string | null = null;
  const genesisHash = String(rows[0].content_hash);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const check = await verifySingleChainRow(row, i, previousCalculatedHash, options.signingKeySecret);

    if (!check.isValid) {
      return {
        isValid: false,
        checkedCount: i,
        tamperedEventId: String(row.id),
        tamperedIndex: i,
        error: check.error,
      };
    }

    previousCalculatedHash = check.recomputedHash ?? null;
  }

  const latestHash = String(rows[rows.length - 1].content_hash);

  return {
    isValid: true,
    checkedCount: rows.length,
    genesisHash,
    latestHash,
  };
}

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
