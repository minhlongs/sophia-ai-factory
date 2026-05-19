/**
 * POST /api/openclaw/exchange
 *
 * Mints a short-lived stateless HMAC token that a Sophia user can paste into
 * their OpenClaw plugin instead of copy-pasting the raw `__Secure-better-auth.
 * session_token` cookie. The token is reusable until expiry (default 1h) and
 * carries only the userId — no PII.
 *
 * Token format (single line, percent-encoded):
 *   `${userId}.${expiresAt}.${base64(HMAC_SHA256(`${userId}.${expiresAt}`, BETTER_AUTH_SECRET))}`
 *
 * Server-side verifier lives in `seed/auth/openclaw-token.ts` and is called by
 * any handler that wants to authenticate an OpenClaw plugin caller via
 * `Authorization: Bearer <token>` header.
 *
 * Doctrine: customer BYOK — operator never sees this token; it is minted only
 * when the caller already has a valid Better Auth session (i.e. has logged in
 * to https://sophia.agencyos.network in a browser). Re-mint via a fresh POST
 * whenever the existing token expires.
 *
 * @module app/api/openclaw/exchange
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

/** Default TTL — 1 hour. Plugin can re-mint as needed. */
const DEFAULT_TTL_SECONDS = 3600;
const MAX_TTL_SECONDS = 7 * 24 * 3600; // hard ceiling 7d

interface ExchangeRequestBody {
  ttlSeconds?: number;
}

interface ExchangeResponse {
  token: string;
  expiresAt: number;
  userId: string;
}

async function signWithBetterAuthSecret(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  // Base64url (no padding) for URL-safe transport
  const bytes = new Uint8Array(sigBuf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || '';
  if (!secret) {
    logger.error('[openclaw/exchange] BETTER_AUTH_SECRET missing — cannot mint token');
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  let ttlSeconds = DEFAULT_TTL_SECONDS;
  try {
    const body = (await request.json()) as ExchangeRequestBody;
    if (typeof body?.ttlSeconds === 'number' && body.ttlSeconds > 0) {
      ttlSeconds = Math.min(Math.floor(body.ttlSeconds), MAX_TTL_SECONDS);
    }
  } catch {
    // No body OR non-JSON body — use defaults.
  }

  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${user.id}.${expiresAt}`;
  const sig = await signWithBetterAuthSecret(payload, secret);
  const token = `${payload}.${sig}`;

  const responseBody: ExchangeResponse = {
    token,
    expiresAt,
    userId: user.id,
  };
  return NextResponse.json(responseBody);
}
