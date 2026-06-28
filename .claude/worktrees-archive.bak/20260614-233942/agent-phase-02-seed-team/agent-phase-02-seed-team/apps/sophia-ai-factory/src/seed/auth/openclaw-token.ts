/**
 * OpenClaw exchange token — verifier + revocation utilities.
 *
 * Token format (v2 — includes JTI):
 *   `${userId}.${expiresAt}.${jti}.${base64url(HMAC_SHA256("userId.expiresAt.jti", secret))}`
 *
 * Changes from v1:
 *   - JTI (UUID v4) embedded in payload → enables server-side revocation.
 *   - Verifier checks `openclaw_revoked_tokens` table before accepting.
 *   - `verifyOpenclawToken` now requires D1 access (async, one extra lookup).
 *
 * Revocation:
 *   Call `revokeOpenclawToken(jti, reason)` to invalidate a specific token.
 *   No endpoint yet — expose only when admin UI is built.
 *
 * @module seed/auth/openclaw-token
 */
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { User } from '@/seed/db/client';

// ── Internal helpers ────────────────────────────────────────────────────────

/** Constant-time string comparison — avoids timing oracle on signature. */
function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** HMAC-SHA256 over `payload`, returns base64url (no padding). */
export async function hmacBase64url(payload: string, secret: string): Promise<string> {
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

/** Generate a UUID v4 using Web Crypto (available in CF Workers + Node ≥ 19). */
export function generateJti(): string {
  return crypto.randomUUID();
}

interface OpenclawTokenParts {
  userId: string;
  expiresAt: number;
  jti: string;
  signature: string;
  payload: string; // "userId.expiresAt.jti"
}

function parseOpenclawToken(raw: string): OpenclawTokenParts | null {
  const parts = raw.split('.');
  if (parts.length === 3) {
    // v1 legacy token (no JTI) — reject; cannot revoke, force re-mint.
    return null;
  }
  if (parts.length !== 4) return null;
  const [userId, expiresAtStr, jti, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!userId || !expiresAtStr || !jti || !signature || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    return null;
  }
  return {
    userId,
    expiresAt,
    jti,
    signature,
    payload: `${userId}.${expiresAtStr}.${jti}`,
  };
}

// ── Public token API ────────────────────────────────────────────────────────

export interface VerifiedOpenclawToken {
  userId: string;
  expiresAt: number;
  jti: string;
}

/**
 * Verify a raw v2 exchange token.
 *
 * Checks (in order):
 *   1. Parse shape (4 parts)
 *   2. Expiry (cheap, short-circuits before DB + HMAC)
 *   3. HMAC signature
 *   4. JTI revocation (D1 lookup)
 *
 * Returns null on any failure — callers must not distinguish the reason
 * to avoid oracle attacks.
 */
export async function verifyOpenclawToken(raw: string): Promise<VerifiedOpenclawToken | null> {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET=REDACTED || '';
  if (!secret) return null;

  const parts = parseOpenclawToken(raw);
  if (!parts) return null;

  // Expiry first — cheap short-circuit.
  const nowSec = Math.floor(Date.now() / 1000);
  if (parts.expiresAt <= nowSec) return null;

  // HMAC verification.
  const expected = await hmacBase64url(parts.payload, secret);
  if (!timingSafeEqualStrings(expected, parts.signature)) return null;

  // JTI revocation check.
  try {
    const db = await getD1Raw();
    const revoked = await db
      .prepare('SELECT 1 FROM openclaw_revoked_tokens WHERE jti = ?1 LIMIT 1')
      .bind(parts.jti)
      .first<{ '1': number }>();
    if (revoked) return null;
  } catch (err) {
    // If D1 is unavailable, fail closed — cannot verify revocation.
    logger.error('[openclaw-token] revocation check failed', toError(err), { jti: parts.jti });
    return null;
  }

  return { userId: parts.userId, expiresAt: parts.expiresAt, jti: parts.jti };
}

/**
 * Revoke a specific token by JTI.
 *
 * No HTTP endpoint yet — call from admin scripts or server actions.
 * When an endpoint is added it MUST be admin-only.
 */
export async function revokeOpenclawToken(jti: string, reason?: string): Promise<void> {
  const db = await getD1Raw();
  const nowSec = Math.floor(Date.now() / 1000);
  await db
    .prepare('INSERT OR IGNORE INTO openclaw_revoked_tokens (jti, revoked_at, reason) VALUES (?1, ?2, ?3)')
    .bind(jti, nowSec, reason ?? null)
    .run();
}

// ── Bearer extraction + combined auth helper ────────────────────────────────

function extractBearer(headers: Headers): string | null {
  const raw = headers.get('authorization');
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolve the calling user from EITHER:
 *   1. `Authorization: Bearer <exchange_token>` (v2 with JTI, preferred)
 *   2. Better Auth session cookie
 *
 * Returns null if neither path produces a valid user.
 */
export async function getCurrentUserOrOpenclawBearer(headers: Headers): Promise<User | null> {
  const bearer = extractBearer(headers);
  if (bearer) {
    const verified = await verifyOpenclawToken(bearer);
    if (verified) {
      try {
        const db = await getD1Raw();
        const row = await db
          .prepare(
            'SELECT id, email, name, role, "emailVerified" AS email_verified FROM user WHERE id = ?1 LIMIT 1',
          )
          .bind(verified.userId)
          .first<{
            id: string;
            email: string;
            name: string | null;
            role: string | null;
            email_verified: number | null;
          }>();
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
