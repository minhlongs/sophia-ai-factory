/**
 * Single row verification and hash-link validation helpers for Sovereign Audit Chain Verifier.
 * @module tree/sovereignty/ledger/chain-row-verifier
 */

import type { RowVerificationResult } from './types';
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

  const linkCheck = checkPrevHashLink(index, rowPrevHash, previousCalculatedHash);
  if (!linkCheck.valid) {
    return { isValid: false, error: linkCheck.error };
  }

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
