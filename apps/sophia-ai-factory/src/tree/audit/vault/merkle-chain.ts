/**
 * Cryptographic hash-chain calculation and canonical JSON serialization.
 *
 *   content_hash = sha256(prev_hash + timestamp + action + actor + payload)
 *
 * @module tree/audit/vault/merkle-chain
 */

import { createHash } from 'node:crypto';

/**
 * Deterministically serialize a JavaScript value to canonical JSON.
 * Recursively sorts all object keys alphabetically to guarantee that
 * identical payloads produce the identical string representation.
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
 * Canonical formula for Enterprise Audit Content Hash:
 * content_hash = sha256(prev_hash + timestamp + action + actor + payload)
 *
 * Format: `${prevHash || 'GENESIS'}|${timestamp}|${action}|${actorId}|${canonicalPayload}`
 */
export function computeEnterpriseContentHash(
  prevHash: string | null,
  timestamp: number,
  action: string,
  actorId: string,
  payload: Record<string, unknown> = {},
): string {
  const normalizedPrev = prevHash || 'GENESIS';
  const canonicalPayload = canonicalJson(payload);
  const data = `${normalizedPrev}|${timestamp}|${action}|${actorId}|${canonicalPayload}`;

  return createHash('sha256').update(data).digest('hex');
}
