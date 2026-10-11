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
  type TokenVerificationResult,
  type GenerateTokenParams,
  type GeneratedTokenResult,
  TOKEN_PREFIX,
} from './types';
import {
  toBase64Url,
  fromBase64Url,
  bufferToHex,
  importHmacKey,
  hashTenantToken,
} from './token-signer';

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

/**
 * Cryptographically verifies an incoming AGY tenant token signature and expiry.
 */
export async function verifyTenantTokenSignature(
  token: string | null | undefined,
  secret: string,
  currentTimeSeconds: number = Math.floor(Date.now() / 1000)
): Promise<TokenVerificationResult> {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Missing token', errorCode: 'INVALID_FORMAT' };
  }
  if (!secret) {
    return { valid: false, reason: 'Missing verification secret', errorCode: 'INVALID_SIGNATURE' };
  }
  if (!token.startsWith(TOKEN_PREFIX)) {
    return { valid: false, reason: 'Invalid token prefix', errorCode: 'INVALID_FORMAT' };
  }

  const tokenBody = token.slice(TOKEN_PREFIX.length);
  const parts = tokenBody.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Malformed token structure', errorCode: 'INVALID_FORMAT' };
  }

  const [payloadB64, signatureHex] = parts;
  if (!payloadB64 || !signatureHex) {
    return { valid: false, reason: 'Empty token components', errorCode: 'INVALID_FORMAT' };
  }

  // 1. Verify HMAC-SHA256 signature
  try {
    const key = await importHmacKey(secret);
    const enc = new TextEncoder();
    const expectedSigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
    const expectedSigHex = bufferToHex(expectedSigBuffer);

    // Constant-time comparison
    if (signatureHex.length !== expectedSigHex.length) {
      return { valid: false, reason: 'Signature mismatch', errorCode: 'INVALID_SIGNATURE' };
    }
    let diff = 0;
    for (let i = 0; i < signatureHex.length; i++) {
      diff |= signatureHex.charCodeAt(i) ^ expectedSigHex.charCodeAt(i);
    }
    if (diff !== 0) {
      return { valid: false, reason: 'Signature mismatch', errorCode: 'INVALID_SIGNATURE' };
    }
  } catch (err) {
    return { valid: false, reason: `Cryptographic error: ${String(err)}`, errorCode: 'INVALID_SIGNATURE' };
  }

  // 2. Decode and validate JSON payload
  let payload: TenantTokenPayload;
  try {
    const payloadJson = fromBase64Url(payloadB64);
    payload = JSON.parse(payloadJson);
  } catch {
    return { valid: false, reason: 'Corrupted payload JSON', errorCode: 'CORRUPTED_PAYLOAD' };
  }

  if (!payload.agencyId || !Array.isArray(payload.permissions)) {
    return { valid: false, reason: 'Incomplete payload fields', errorCode: 'CORRUPTED_PAYLOAD' };
  }

  // 3. Expiration check
  if (payload.expiresAt !== null && payload.expiresAt < currentTimeSeconds) {
    return {
      valid: false,
      payload,
      reason: `Token expired at ${new Date(payload.expiresAt * 1000).toISOString()}`,
      errorCode: 'EXPIRED',
    };
  }

  return {
    valid: true,
    payload,
  };
}
