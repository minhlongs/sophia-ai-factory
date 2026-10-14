import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { OpenclawTokenParts, VerifiedOpenclawToken } from './types';
import { hmacBase64url, timingSafeEqualStrings } from './crypto-helpers';

export function parseOpenclawToken(raw: string): OpenclawTokenParts | null {
  const parts = raw.split('.');
  if (parts.length === 3) {
    // v1 legacy token (no JTI) — reject; cannot revoke, force re-mint.
    return null;
  }
  if (parts.length !== 4) return null;
  const [userId, expiresAtStr, jti, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (
    !userId ||
    !expiresAtStr ||
    !jti ||
    !signature ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= 0
  ) {
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
  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || '';
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
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
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
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const nowSec = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      'INSERT OR IGNORE INTO openclaw_revoked_tokens (jti, revoked_at, reason) VALUES (?1, ?2, ?3)',
    )
    .bind(jti, nowSec, reason ?? null)
    .run();
}
