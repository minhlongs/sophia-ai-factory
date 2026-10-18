/**
 * HMAC-SHA-256 Signatures and Challenge Tokens for Admin Actions
 * Layer: seed
 *
 * @module seed/auth/admin/challenge-token
 */

import type { ChallengePayload, RecentAuthResult } from './types';
import {
  toBase64,
  getAdminSecret,
  parseAndVerifySignature,
} from './challenge-token-helpers';

/** Derive an HMAC-SHA-256 key from the application secret. */
export async function deriveHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Mint an admin_challenge_token cookie value.
 * Format: base64url(payload_json).base64url(signature)
 * Called by /api/auth/admin-challenge on successful password/MFA verify.
 */
export async function mintAdminChallengeToken(
  userId: string,
  secret: string,
): Promise<string> {
  const payload: ChallengePayload = { userId, issuedAt: Date.now() };
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const key = await deriveHmacKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify admin_challenge_token cookie on a protected mutation.
 * Returns ok=true only when signature is valid AND token is within maxAgeMs.
 */
export async function requireRecentAuth(
  request: Request,
  maxAgeMs = 5 * 60 * 1000,
): Promise<RecentAuthResult> {
  const secret = getAdminSecret();
  if (!secret) {
    return { ok: false, reason: 'invalid' };
  }

  const cookieHeader = request.headers
    .get('cookie')
    ?.split(';')
    .find((c) => c.trim().startsWith('admin_challenge_token='))
    ?.split('=')
    .slice(1)
    .join('=');

  if (!cookieHeader) {
    return { ok: false, reason: 'no-challenge' };
  }

  const dotIdx = cookieHeader.lastIndexOf('.');
  if (dotIdx === -1) {
    return { ok: false, reason: 'invalid' };
  }

  const payloadB64 = cookieHeader.slice(0, dotIdx);
  const sigB64 = cookieHeader.slice(dotIdx + 1);

  const parsed = parseAndVerifySignature(payloadB64, sigB64);
  if (!parsed.validSig || !parsed.payload) {
    return { ok: false, reason: 'invalid' };
  }

  try {
    const key = await deriveHmacKey(secret);
    const decoded = atob(toBase64(sigB64));
    const sigBytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) sigBytes[i] = decoded.charCodeAt(i);

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as BufferSource,
      new TextEncoder().encode(payloadB64),
    );

    if (!valid) {
      return { ok: false, reason: 'invalid' };
    }
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (Date.now() - parsed.payload.issuedAt > maxAgeMs) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true };
}
