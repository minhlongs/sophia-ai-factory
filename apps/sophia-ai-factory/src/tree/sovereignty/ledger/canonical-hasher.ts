/**
 * @file canonical-hasher.ts
 * @description Canonical serialization and SHA-256 content hashing for compliance audit records.
 * @layer tree
 */

import { bytesToHex } from '../cmek-envelope-engine';

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
