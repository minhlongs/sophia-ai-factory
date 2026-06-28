/**
 * Telegram pairing token service.
 *
 * Generates 32-char hex tokens stored in `telegram_pairing_tokens`.
 * Used in the web welcome page "Connect Telegram" flow:
 *   1. generatePairingToken(userId) → token
 *   2. User clicks t.me/Sophia_Bbot?start=<token>
 *   3. Bot /start handler calls consumePairingToken(token) → userId
 *   4. Bot links chat_id to userId in telegram_paired_chats
 *
 * @module tree/telegram/pairing-token-service
 */

import type { D1Client } from '@/seed/db/d1-query-builder'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

function generateHexToken(): string {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function nowIso(): string {
  return new Date().toISOString()
}

function expiresIso(): string {
  return new Date(Date.now() + TOKEN_TTL_MS).toISOString()
}

/**
 * Generate a single-use pairing token tied to a web user ID.
 * Existing un-used tokens for this user are NOT deleted (allow multiple browser tabs).
 */
export async function generatePairingToken(
  db: D1Client,
  userId: string,
): Promise<string> {
  const token = generateHexToken()
  await db.from('telegram_pairing_tokens').upsert({
    token,
    user_id: userId,
    created_at: nowIso(),
    expires_at: expiresIso(),
    used_at: null,
  })
  return token
}

/**
 * Consume a pairing token.
 * Returns the userId if token is valid, not expired, and not yet used.
 *
 * Atomic: a single `UPDATE … WHERE used_at IS NULL AND expires_at >= ? RETURNING user_id`
 * statement marks the token used and returns the owner in one round-trip.
 * Concurrent consumers race on the row lock; only one observes a row.
 */
export async function consumePairingToken(
  db: D1Client,
  token: string,
): Promise<{ userId: string } | null> {
  const now = nowIso()
  const result = await db
    .unwrap()
    .prepare(
      'UPDATE telegram_pairing_tokens SET used_at = ? WHERE token = ? AND used_at IS NULL AND expires_at >= ? RETURNING user_id',
    )
    .bind(now, token, now)
    .first<{ user_id: string }>()

  return result ? { userId: result.user_id } : null
}
