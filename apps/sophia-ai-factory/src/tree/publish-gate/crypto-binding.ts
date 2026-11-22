/**
 * Compliance Publish Gate — Canonical Cryptographic Binding & Idempotency.
 *
 * Uses Web Crypto API (SHA-256) for Cloudflare Workers & Node 22 parity.
 * Avoids ambiguous string concatenation by encoding structured versioned JSON.
 *
 * Layer: tree (domain logic).
 * @module tree/publish-gate/crypto-binding
 */

import type { PublishGatePayload, PublishGatePlatform } from './types';

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    const sorted: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      sorted[k] = sortKeysDeep(v);
    }
    return sorted;
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deterministic canonical JSON of the immutable publication payload.
 */
export function canonicalizePublishGatePayload(payload: PublishGatePayload): string {
  return JSON.stringify(sortKeysDeep(payload));
}

/**
 * Versioned SHA-256 digest binding media, account, privacy, caption, disclosures, and mode.
 */
export async function computePublishGatePayloadDigest(
  payload: PublishGatePayload,
): Promise<string> {
  const canonical = canonicalizePublishGatePayload(payload);
  const hex = await sha256Hex(`b2_payload_v1:${canonical}`);
  return `v1:sha256:${hex}`;
}

export interface IdempotencyIdentityInput {
  readonly orgId: string;
  readonly campaignId: string;
  readonly platform: PublishGatePlatform;
  readonly mediaContentDigest: string;
  readonly destinationAccountId: string;
  readonly payloadVersion: number;
}

/**
 * Collision-resistant versioned idempotency key over structured JSON tuple.
 * Never embeds secrets or relies on ambiguous delimiter concatenation.
 */
export async function computePublishGateIdempotencyKey(
  input: IdempotencyIdentityInput,
): Promise<string> {
  const canonical = JSON.stringify({
    v: 1,
    orgId: input.orgId.trim(),
    campaignId: input.campaignId.trim(),
    platform: input.platform,
    mediaContentDigest: input.mediaContentDigest.trim(),
    destinationAccountId: input.destinationAccountId.trim(),
    payloadVersion: Math.max(1, Math.trunc(input.payloadVersion)),
  });
  const hex = await sha256Hex(`b2_idemp_v1:${canonical}`);
  return `b2idem_v1_${hex}`;
}

/**
 * Generates a cryptographically random single-use approval nonce.
 */
export function generateApprovalNonce(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `b2nonce_${hex}`;
}

/**
 * Constant-time string comparison for digests and nonces.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
