/**
 * Tenant Token Cryptographic Engine
 *
 * Provides pure Web Crypto HMAC-SHA256 token issuance, cryptographic verification,
 * tamper detection, expiry enforcement, and granular permission checking.
 *
 * Invariants:
 * - Edge runtime compliant: strictly uses Web Crypto API (crypto.subtle).
 * - Layer: tree (pure deterministic domain logic, zero database or network dependencies).
 * - Format: agy_tok_<base64UrlPayload>.<signatureHex>
 *
 * @module tree/agy/tenant-token-engine
 */

import type { AgyTenantToken } from '@/seed/types/agy-multitenancy';

export interface TenantTokenPayload {
  agencyId: string;
  name: string;
  permissions: string[];
  issuedAt: number;
  expiresAt: number | null;
  nonce: string;
}

export interface TokenVerificationResult {
  valid: boolean;
  payload?: TenantTokenPayload;
  reason?: string;
  errorCode?: 'INVALID_FORMAT' | 'INVALID_SIGNATURE' | 'EXPIRED' | 'CORRUPTED_PAYLOAD';
}

const TOKEN_PREFIX = 'agy_tok_';

/**
 * Base64URL string encoder
 */
function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL string decoder
 */
function fromBase64Url(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Converts ArrayBuffer to lowercase Hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  let hexString = '';
  for (let i = 0; i < byteArray.length; i++) {
    hexString += byteArray[i].toString(16).padStart(2, '0');
  }
  return hexString;
}

/**
 * Import raw secret as CryptoKey for HMAC-SHA256
 */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign', 'verify']
  );
}

/**
 * Computes deterministic SHA-256 hash of a token string for database storage/lookup.
 */
export async function hashTenantToken(token: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return bufferToHex(digest);
}

/**
 * Generates a signed AGY tenant token using Web Crypto HMAC-SHA256.
 */
export async function generateTenantToken(
  params: {
    agencyId: string;
    name?: string;
    permissions?: string[];
    expiresInSeconds?: number | null;
  },
  secret: string
): Promise<{
  token: string;
  tokenHash: string;
  payload: TenantTokenPayload;
  model: AgyTenantToken;
}> {
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

/**
 * Validates whether a token's permissions satisfy the required permission scope.
 * Supports:
 * - Wildcard '*' or 'admin' grants all permissions
 * - Exact permission match ('read', 'write', 'video:generate')
 * - Namespace wildcard match ('video:*' matches 'video:generate')
 */
export function validateTokenPermissions(
  tokenPermissions: string[] | null | undefined,
  requiredPermission: string
): boolean {
  if (!requiredPermission) return true;
  if (!tokenPermissions || !Array.isArray(tokenPermissions) || tokenPermissions.length === 0) {
    return false;
  }

  const req = requiredPermission.trim().toLowerCase();

  for (const perm of tokenPermissions) {
    const p = perm.trim().toLowerCase();
    if (p === '*' || p === 'admin') return true;
    if (p === req) return true;

    // Namespace wildcard check (e.g. "agency:*" matches "agency:read")
    if (p.endsWith(':*')) {
      const prefix = p.slice(0, -1); // e.g. "agency:"
      if (req.startsWith(prefix)) return true;
    }
  }

  return false;
}
