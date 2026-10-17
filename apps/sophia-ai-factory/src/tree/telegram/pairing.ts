/**
 * Telegram DM Pairing — allowlist gate for unknown senders.
 *
 * Flow:
 *   1. isAllowed(db, chatId) — check telegram_paired_chats
 *   2. If not allowed → requestPairing() generates 6-digit code, stored 15min
 *   3. Admin runs /pair_approve <CODE> → approvePairing() moves to paired
 *   4. Admin runs /pair_list, /pair_revoke <CHAT_ID> for management
 *
 * Expired pending rows are cleaned up inline on each requestPairing() call.
 */

import type { D1Client } from '@/seed/db/d1-query-builder'

export {
  approvePairing,
  listPaired,
  revokePairing,
} from './pairing-admin'

const PAIRING_TTL_MS = 15 * 60 * 1000 // 15 minutes

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PairedChat {
  chat_id: string
  first_name: string | null
  paired_at: string
  paired_by: string
}

export interface PendingPairing {
  chat_id: string
  code: string
  requested_at: string
  expires_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generate6DigitCode(): string {
  // CSPRNG via Web Crypto — Math.random is predictable in V8 isolates and
  // 6-digit codes already have a small (1M) keyspace. Use cryptographically
  // strong randomness even though /pair_approve is admin-gated (defense-in-depth).
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return (100000 + (buf[0] % 900000)).toString()
}

function nowIso(): string {
  return new Date().toISOString()
}

function expiresIso(): string {
  return new Date(Date.now() + PAIRING_TTL_MS).toISOString()
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if chatId is in the paired allowlist.
 */
export async function isAllowed(db: D1Client, chatId: string): Promise<boolean> {
  const { data } = await db
    .from('telegram_paired_chats')
    .select('chat_id')
    .eq('chat_id', chatId)
    .maybeSingle()
  return data !== null && data !== undefined
}

/**
 * Creates (or refreshes) a pending pairing entry.
 * Returns the 6-digit code to relay to the user.
 * Performs inline cleanup of all expired pending rows.
 */
export async function requestPairing(
  db: D1Client,
  chatId: string,
  firstName?: string
): Promise<{ code: string }> {
  const now = nowIso()

  // Inline cleanup: remove expired entries
  await db
    .from('telegram_pending_pairing')
    .delete()
    .lt('expires_at', now)

  const code = generate6DigitCode()
  const expires_at = expiresIso()

  // Upsert: replace existing pending row for this chat_id
  await db.from('telegram_pending_pairing').upsert({
    chat_id: chatId,
    code,
    requested_at: now,
    expires_at,
    // Store first_name in code comment field not available — omit, firstName used only on approve
    ...(firstName !== undefined ? {} : {}),
  })

  return { code }
}
