import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import type { User } from '@/seed/db/client';

export type RequireAdminResult = { user: User } | NextResponse;

/** Result type for recent-auth challenge check. */
export type RecentAuthResult =
  | { ok: true }
  | { ok: false; reason: 'no-challenge' | 'expired' | 'invalid' };

/**
 * Payload embedded in the admin_challenge_token cookie.
 * Signed via HMAC-SHA-256 with BETTER_AUTH_SECRET.
 * Format (JSON):  {"userId":"...","issuedAt":1234567890}
 */
interface ChallengePayload {
  userId: string;
  issuedAt: number;
}

/** Derive an HMAC-SHA-256 key from the application secret. */
async function deriveHmacKey(secret: string): Promise<CryptoKey> {
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
 * Reads the `admin_challenge_token` cookie (HttpOnly, Secure, SameSite=Strict).
 * Returns ok=true only when signature is valid AND token is within maxAgeMs.
 */
export async function requireRecentAuth(
  request: NextRequest | Request,
  maxAgeMs = 5 * 60 * 1000,
): Promise<RecentAuthResult> {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
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

  // Re-pad base64url → base64
  const toBase64 = (s: string) =>
    s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((s.length + 3) % 4 || 4);

  let payload: ChallengePayload;
  try {
    payload = JSON.parse(atob(toBase64(payloadB64))) as ChallengePayload;
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  // Verify HMAC signature
  let sigBytes: ArrayBuffer;
  try {
    const sigArr = Uint8Array.from(atob(toBase64(sigB64)), (c) => c.charCodeAt(0));
    sigBytes = sigArr.buffer.slice(sigArr.byteOffset, sigArr.byteOffset + sigArr.byteLength);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const key = await deriveHmacKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(payloadB64),
  );

  if (!valid) {
    return { ok: false, reason: 'invalid' };
  }

  // Check age
  if (Date.now() - payload.issuedAt > maxAgeMs) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true };
}

/**
 * Gate a route on Better Auth session + role === 'admin'.
 * Returns { user } on success, or a NextResponse with 401/403 on failure.
 *
 * Usage:
 *   const auth = await requireAdmin(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user } = auth;
 */
export async function requireAdmin(
  request: NextRequest | Request,
): Promise<RequireAdminResult> {
  const headers =
    request instanceof Request
      ? request.headers
      : (request as NextRequest).headers;
  const user = await getCurrentUserFromHeaders(headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: admin role required' },
      { status: 403 },
    );
  }
  return { user };
}
