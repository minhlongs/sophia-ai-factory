/**
 * HMAC-SHA-256 Signatures and Challenge Tokens for Admin Actions
 * Layer: seed
 *
 * @module seed/auth/admin/challenge-token
 */

import { logger } from '@/seed/utils/logger-utility';
import type { ChallengePayload, RecentAuthResult } from './types';

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

function toBase64(s: string): string {
  const str = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (str.length % 4)) % 4;
  return str + '='.repeat(pad);
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

function getAdminSecret(): string | undefined {
  const secret = process.env.ADMIN_CHALLENGE_SECRET || process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!process.env.ADMIN_CHALLENGE_SECRET && (process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET)) {
    const globalWithFlag = globalThis as typeof globalThis & { _adminChallengeSecretWarned?: boolean };
    if (!globalWithFlag._adminChallengeSecretWarned) {
      logger.warn('[require-admin] ADMIN_CHALLENGE_SECRET not set — falling back to BETTER_AUTH_SECRET/JWT_SECRET. Set dedicated secret for key separation.');
      globalWithFlag._adminChallengeSecretWarned = true;
    }
  }
  return secret;
}

function parseAndVerifySignature(
  payloadB64: string,
  sigB64: string,
): { validSig: boolean; payload?: ChallengePayload } {
  let payload: ChallengePayload;
  try {
    payload = JSON.parse(atob(toBase64(payloadB64))) as ChallengePayload;
  } catch {
    return { validSig: false };
  }

  try {
    const decoded = atob(toBase64(sigB64));
    const sigBytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      sigBytes[i] = decoded.charCodeAt(i);
    }

    if (sigBytes.length !== 32) {
      return { validSig: false };
    }

    const canonicalSigB64 = btoa(String.fromCharCode(...sigBytes))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    if (sigB64 !== canonicalSigB64) {
      return { validSig: false };
    }

    return { validSig: true, payload };
  } catch {
    return { validSig: false };
  }
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
