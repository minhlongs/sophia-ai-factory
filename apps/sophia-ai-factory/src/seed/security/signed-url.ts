/**
 * Timing-Safe 24-Hour HMAC-SHA256 Signed Download URL Generator & Verifier
 *
 * Designed for Cloudflare Workers edge runtime and V8 isolates:
 * - Pure Web Crypto API (`crypto.subtle` / `globalThis.crypto.subtle`)
 * - Zero Node.js built-ins (`crypto`, `node:crypto`, `Buffer`)
 * - Format: `${payloadBase64Url}.${signatureHex}`
 * - Constant-time XOR comparison against timing attacks
 * - Default TTL: 86,400 seconds (24 hours) to prevent bandwidth leaks and hotlinking
 *
 * Layer: seed/security (Foundational primitive)
 * Dependencies: seed/types/streaming (0 upper-layer imports)
 *
 * @module seed/security/signed-url
 */

import type {
  SignedDownloadTokenPayload,
  CreateSignedDownloadTokenParams,
  VerifySignedDownloadTokenParams,
  VerifySignedDownloadTokenResult,
} from '@/seed/types/streaming';

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 86400; // 24 hours

const ENC = new TextEncoder();
const DEC = new TextDecoder();

/**
 * Resolves SubtleCrypto across Cloudflare Workers, Node.js 18+, and browser environments.
 */
function getSubtle(): SubtleCrypto {
  const c = typeof crypto !== 'undefined' ? crypto : (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is unavailable in current runtime');
  }
  return c.subtle;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Iterates through all characters using bitwise XOR without early termination.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

/**
 * Encodes string to URL-safe Base64 without padding (RFC 4648 §5).
 * Edge-safe: zero Buffer dependency.
 */
export function stringToBase64Url(input: string): string {
  const bytes = ENC.encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes URL-safe Base64 string to original UTF-8 string.
 * Edge-safe: zero Buffer dependency.
 */
export function base64UrlToString(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return DEC.decode(bytes);
}

/**
 * Computes HMAC-SHA256 hex digest for given data and secret.
 */
export async function computeHmacSha256Hex(secret: string, data: string): Promise<string> {
  const subtle = getSubtle();
  const keyData = ENC.encode(secret);

  const cryptoKey = await subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await subtle.sign('HMAC', cryptoKey, ENC.encode(data));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates a signed download token valid for 24 hours (or specified TTL).
 * Supports both params object and positional arguments.
 *
 * Token format: `${base64UrlPayload}.${signatureHex}`
 */
export async function createSignedDownloadToken(
  params: CreateSignedDownloadTokenParams
): Promise<string>;
export async function createSignedDownloadToken(
  videoId: string,
  userId: string,
  ttlSeconds: number,
  secret: string,
  tenantId?: string
): Promise<string>;
export async function createSignedDownloadToken(
  paramOrVideoId: CreateSignedDownloadTokenParams | string,
  userId?: string,
  ttlSeconds?: number,
  secret?: string,
  tenantId?: string
): Promise<string> {
  let vId: string;
  let uId: string;
  let tId: string;
  let ttl: number;
  let sec: string;

  if (typeof paramOrVideoId === 'object' && paramOrVideoId !== null) {
    vId = paramOrVideoId.videoId;
    uId = paramOrVideoId.userId;
    tId = paramOrVideoId.tenantId;
    ttl = paramOrVideoId.ttlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS;
    sec = paramOrVideoId.secret;
  } else {
    vId = paramOrVideoId;
    uId = userId ?? '';
    tId = tenantId ?? 'default-tenant';
    ttl = ttlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS;
    sec = secret ?? '';
  }

  if (!sec || typeof sec !== 'string') {
    throw new Error('INVALID_SECRET: secret must be a non-empty string');
  }
  if (!vId || typeof vId !== 'string') {
    throw new Error('INVALID_VIDEO_ID: videoId must be a non-empty string');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = nowSec + ttl;

  const payload: SignedDownloadTokenPayload = {
    videoId: vId,
    userId: uId,
    tenantId: tId,
    issuedAt: nowSec,
    expiresAt,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = stringToBase64Url(payloadJson);
  const signatureHex = await computeHmacSha256Hex(sec, payloadB64);

  return `${payloadB64}.${signatureHex}`;
}

/**
 * Verifies a signed download token.
 * Validates HMAC signature with constant-time equality check and checks expiration.
 * Supports both params object and positional arguments.
 */
export async function verifySignedDownloadToken(
  params: VerifySignedDownloadTokenParams
): Promise<VerifySignedDownloadTokenResult>;
export async function verifySignedDownloadToken(
  token: string,
  videoId: string,
  secret: string
): Promise<VerifySignedDownloadTokenResult>;
export async function verifySignedDownloadToken(
  paramOrToken: VerifySignedDownloadTokenParams | string,
  maybeVideoId?: string,
  maybeSecret?: string
): Promise<VerifySignedDownloadTokenResult> {
  let token: string;
  let videoId: string;
  let secret: string;

  if (typeof paramOrToken === 'object' && paramOrToken !== null) {
    token = paramOrToken.token;
    videoId = paramOrToken.videoId;
    secret = paramOrToken.secret;
  } else {
    token = paramOrToken;
    videoId = maybeVideoId ?? '';
    secret = maybeSecret ?? '';
  }

  if (!token || typeof token !== 'string' || !videoId || !secret) {
    return { valid: false, expired: false };
  }

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1 || dotIdx === 0 || dotIdx === token.length - 1) {
    return { valid: false, expired: false };
  }

  const payloadB64 = token.substring(0, dotIdx);
  const signatureHex = token.substring(dotIdx + 1);

  // Recompute HMAC signature
  try {
    const expectedSig = await computeHmacSha256Hex(secret, payloadB64);
    if (!timingSafeEqual(signatureHex.toLowerCase(), expectedSig.toLowerCase())) {
      return { valid: false, expired: false };
    }

    // Decode and parse payload
    const payloadJson = base64UrlToString(payloadB64);
    const parsed = JSON.parse(payloadJson) as Partial<SignedDownloadTokenPayload>;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.videoId !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      typeof parsed.issuedAt !== 'number'
    ) {
      return { valid: false, expired: false };
    }

    // Verify videoId match (prevents token reuse across different videos)
    if (parsed.videoId !== videoId) {
      return { valid: false, expired: false };
    }

    const payload: SignedDownloadTokenPayload = {
      videoId: parsed.videoId,
      userId: parsed.userId ?? '',
      tenantId: parsed.tenantId ?? '',
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };

    // Check expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > payload.expiresAt) {
      return { valid: false, expired: true, payload };
    }

    return { valid: true, expired: false, payload };
  } catch {
    return { valid: false, expired: false };
  }
}

/**
 * Helper to build an absolute signed download URL given a base URL and token.
 */
export function buildSignedDownloadUrl(baseUrl: string, videoId: string, token: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/api/videos/${encodeURIComponent(videoId)}/download?token=${encodeURIComponent(token)}`;
  return url;
}
