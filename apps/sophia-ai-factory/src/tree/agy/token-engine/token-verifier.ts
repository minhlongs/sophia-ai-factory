/**
 * Tenant Token Signature Verification Helper
 *
 * Layer: tree/agy/token-engine
 */

import {
  type TenantTokenPayload,
  type TokenVerificationResult,
  TOKEN_PREFIX,
} from './types';
import {
  fromBase64Url,
  bufferToHex,
  importHmacKey,
} from './token-signer';

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
