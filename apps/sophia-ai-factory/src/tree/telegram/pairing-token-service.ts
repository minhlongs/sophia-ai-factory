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

export interface PairingTokenRow {
  token: string
  user_id: string
  created_at: string
  expires_at: string
  used_at: string | null
}

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
 * Marks token as used atomically on success.
 */
export async function consumePairingToken(
  db: D1Client,
  token: string,
): Promise<{ userId: string } | null> {
  const now = nowIso()

  const { data } = await db
    .from('telegram_pairing_tokens')
    .select('token, user_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!data) return null

  const row = data as unknown as PairingTokenRow

  if (row.used_at !== null) return null
  if (row.expires_at < now) return null

  // Mark as used
  await db
    .from('telegram_pairing_tokens')
    .upsert({ ...row, used_at: now })

  return { userId: row.user_id }
}
