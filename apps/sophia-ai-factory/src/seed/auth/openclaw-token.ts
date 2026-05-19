/**
 * OpenClaw exchange token verifier.
 *
 * Companion to `POST /api/openclaw/exchange` (route.ts) which mints tokens of
 * shape:
 *   `${userId}.${expiresAt}.${base64url(HMAC_SHA256("userId.expiresAt", BETTER_AUTH_SECRET))}`
 *
 * Any API route that wants to accept "either browser session cookie OR
 * exchange-token Bearer header" can call `getCurrentUserOrOpenclawBearer()`
 * below.  Bearer is preferred — if both are present, Bearer wins.
 *
 * Stateless: no D1 row is read or written during verify.  Compromised tokens
 * remain valid until expiry; rotate `BETTER_AUTH_SECRET` to invalidate all
 * outstanding tokens at once.
 *
 * @module seed/auth/openclaw-token
 */
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { User } from '@/seed/db/client';

interface OpenclawTokenParts {
  userId: string;
  expiresAt: number;
  signature: string;
  payload: string;
}

function parseOpenclawToken(raw: string): OpenclawTokenParts | null {
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!userId || !signature || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    return null;
  }
  return {
    userId,
    expiresAt,
    signature,
    payload: `${userId}.${expiresAtStr}`,
  };
}

async function expectedSignature(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = new Uint8Array(sigBuf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Constant-time string comparison.  Web Crypto does not expose timingSafeEqual,
 * so this is a manual loop over equal-length strings.  Returns false for
 * unequal lengths without leaking length info beyond what is already visible
 * to the caller (token shape is public).
 */
function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface VerifiedOpenclawToken {
  userId: string;
  expiresAt: number;
}

/** Verify a raw token string.  Returns parts on success, null on failure. */
export async function verifyOpenclawToken(raw: string): Promise<VerifiedOpenclawToken | null> {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || '';
  if (!secret) return null;

  const parts = parseOpenclawToken(raw);
  if (!parts) return null;

  // Expiry first — cheap and short-circuits before HMAC compute.
  const nowSec = Math.floor(Date.now() / 1000);
  if (parts.expiresAt <= nowSec) return null;

  const expected = await expectedSignature(parts.payload, secret);
  if (!timingSafeEqualStrings(expected, parts.signature)) return null;

  return { userId: parts.userId, expiresAt: parts.expiresAt };
}

function extractBearer(headers: Headers): string | null {
  const raw = headers.get('authorization');
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolve the calling user from EITHER:
 *   1. `Authorization: Bearer <exchange_token>` (preferred when present)
 *   2. Better Auth session cookie (`__Secure-better-auth.session_token`)
 *
 * Returns null if neither path produces a valid user.  Routes that accept
 * OpenClaw plugin traffic should call this instead of `getCurrentUser()`.
 */
export async function getCurrentUserOrOpenclawBearer(headers: Headers): Promise<User | null> {
  const bearer = extractBearer(headers);
  if (bearer) {
    const verified = await verifyOpenclawToken(bearer);
    if (verified) {
      try {
        const db = await getD1Raw();
        const row = await db
          .prepare('SELECT id, email, name, role, "emailVerified" AS email_verified FROM user WHERE id = ?1 LIMIT 1')
          .bind(verified.userId)
          .first<{ id: string; email: string; name: string | null; role: string | null; email_verified: number | null }>();
        if (row) {
          return {
            id: row.id,
            email: row.email,
            name: row.name ?? null,
            role: row.role ?? null,
            emailVerified: Boolean(row.email_verified),
          } as unknown as User;
        }
      } catch (err) {
        logger.error('[openclaw-token] D1 user lookup failed', toError(err), { userId: verified.userId });
      }
    }
    // Bearer present but invalid — fall through to cookie auth.
  }

  return getCurrentUserFromHeaders(headers);
}
