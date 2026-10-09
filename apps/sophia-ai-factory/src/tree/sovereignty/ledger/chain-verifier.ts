/**
 * @file chain-verifier.ts
 * @description Cryptographic hash-chain traversal, tampering detection, and verification.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ChainVerificationResult, RowVerificationResult } from './types';
import { computeSovereignContentHash } from './canonical-hasher';
import { verifySignature } from './crypto-signer';

export function checkPrevHashLink(
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

export async function verifySingleChainRow(
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
