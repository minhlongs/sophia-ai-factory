/**
 * Tenant Token Service
 *
 * Provides pure Web Crypto HMAC-SHA256 token issuance and cryptographic verification.
 * Invariants: Edge runtime compliant: strictly uses Web Crypto API (crypto.subtle).
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/agy/token-engine/tenant-token-service
 */

import type { AgyTenantToken } from '@/seed/types/agy-multitenancy';
import {
  type TenantTokenPayload,
  type GenerateTokenParams,
  type GeneratedTokenResult,
  TOKEN_PREFIX,
} from './types';
import {
  toBase64Url,
  bufferToHex,
  importHmacKey,
  hashTenantToken,
} from './token-signer';
import { verifyTenantTokenSignature } from './token-verifier';

export { verifyTenantTokenSignature };

/**
 * Generates a signed AGY tenant token using Web Crypto HMAC-SHA256.
 */
export async function generateTenantToken(
  params: GenerateTokenParams,
  secret: string
): Promise<GeneratedTokenResult> {
  if (!params.agencyId) {
    throw new Error('[tenant-token-engine] agencyId is required');
  }
  if (!secret) {
    throw new Error('[tenant-token-engine] signing secret is required');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt =
    params.expiresInSeconds && params.expiresInSeconds > 0
      ? now + params.expiresInSeconds
      : null;

  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  const nonce = bufferToHex(randomBytes.buffer);

  const payload: TenantTokenPayload = {
    agencyId: params.agencyId,
    name: params.name || 'Default Tenant Token',
    permissions: params.permissions && params.permissions.length > 0 ? params.permissions : ['read', 'write'],
    issuedAt: now,
    expiresAt,
    nonce,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = toBase64Url(payloadJson);

  const key = await importHmacKey(secret);
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const signatureHex = bufferToHex(signatureBuffer);

  const token = `${TOKEN_PREFIX}${payloadB64}.${signatureHex}`;
  const tokenHash = await hashTenantToken(token);

  const model: AgyTenantToken = {
    id: `tok_${nonce}`,
    agencyId: payload.agencyId,
    tokenHash,
    name: payload.name,
    permissions: payload.permissions,
    expiresAt: payload.expiresAt,
    createdAt: now,
    revokedAt: null,
    token,
  };

  return {
    token,
    tokenHash,
    payload,
    model,
  };
}
