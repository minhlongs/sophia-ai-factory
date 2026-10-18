/**
 * HMAC-SHA256 signed reset-password token utility with one-time-use guard.
 *
 * Token format: base64url( JSON({ userId, jti, exp }) ) + "." + hex(HMAC-SHA256)
 * TTL: 1 hour. Secret: BETTER_AUTH_SECRET (same as auth secret).
 *
 * DB record in `password_reset_tokens` ensures each token is consumed once.
 * Compatible with Cloudflare Workers (Web Crypto only, no Node crypto).
 */

import {
  TOKEN_TTL_SECONDS,
  type ResetTokenPayload,
  type D1Binding,
  getSecret,
  toBase64Url,
  fromBase64Url,
  hmacSign,
  hmacVerify,
} from './reset-password-crypto';

export type { ResetTokenPayload, D1Binding };

/**
 * Generate a signed one-time reset token. Inserts jti into DB before returning.
 * Callers MUST pass a D1 binding — the jti record must exist before the token is used.
 */
export async function signResetToken(userId: string, db: D1Binding): Promise<string> {
  const jti = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const expiresAt = exp * 1000; // store as ms for consistency

  const payload: ResetTokenPayload = { userId, jti, exp };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = await hmacSign(payloadB64, getSecret());

  // Insert jti BEFORE returning token — ensures DB record exists for consume
  await db
    .prepare(
      'INSERT INTO password_reset_tokens (id, user_id, expires_at) VALUES (?1, ?2, ?3)',
    )
    .bind(jti, userId, expiresAt)
    .run();

  return `${payloadB64}.${sig}`;
}

/**
 * Verify HMAC + TTL, then atomically mark token as used (one-time-use).
 * Returns userId on success, null on any failure (invalid, expired, replayed).
 */
export async function consumeResetToken(
  token: string,
  db: D1Binding,
): Promise<string | null> {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;

  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const valid = await hmacVerify(payloadB64, sig, getSecret());
  if (!valid) return null;

  let payload: ResetTokenPayload;
  try {
    const parsed = JSON.parse(fromBase64Url(payloadB64)) as Partial<ResetTokenPayload>;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.jti !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (Math.floor(Date.now() / 1000) > parsed.exp) return null;
    payload = parsed as ResetTokenPayload;
  } catch {
    return null;
  }

  // Atomically mark used — only succeeds when used_at IS NULL (first use)
  const result = await db
    .prepare(
      'UPDATE password_reset_tokens SET used_at = ?1 WHERE id = ?2 AND used_at IS NULL',
    )
    .bind(Date.now(), payload.jti)
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    // Already used or jti not found
    return null;
  }

  return payload.userId;
}
