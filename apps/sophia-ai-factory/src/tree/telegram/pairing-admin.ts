/**
 * Telegram DM Pairing — Admin Approval, Listing, and Revocation Helpers.
 *
 * @module tree/telegram/pairing-admin
 */

import type { D1Client } from '@/seed/db/d1-query-builder'
import type { PairedChat, PendingPairing } from './pairing'

/**
 * Admin approves a pairing by code.
 * Moves the pending entry to telegram_paired_chats.
 * Returns paired chatId on success, null if code not found / expired.
 */
export async function approvePairing(
  db: D1Client,
  code: string,
  approverId: string,
  firstName?: string
): Promise<{ chatId: string } | null> {
  const now = new Date().toISOString()

  const { data: pending } = await db
    .from('telegram_pending_pairing')
    .select('chat_id, expires_at')
    .eq('code', code)
    .maybeSingle()

  if (!pending) return null

  const row = pending as unknown as PendingPairing
  // Check expiry
  if (row.expires_at < now) {
    // Clean up expired
    await db.from('telegram_pending_pairing').delete().eq('chat_id', row.chat_id)
    return null
  }

  // Upsert into allowlist.
  // After migration 0100 telegram_paired_chats has UNIQUE(paired_by).
  // ON CONFLICT DO UPDATE SET handles two cases:
  //   1. Same paired_by, different chat_id → updates chat_id/first_name/paired_at (re-pair).
  //   2. Same chat_id (PK) → updates first_name/paired_at/paired_by (admin re-approve).
  // In both cases the newest pairing wins, which matches user intent.
  await db.from('telegram_paired_chats').upsert({
    chat_id: row.chat_id,
    first_name: firstName ?? null,
    paired_at: now,
    paired_by: approverId,
  })

  // Remove from pending
  await db.from('telegram_pending_pairing').delete().eq('chat_id', row.chat_id)

  return { chatId: row.chat_id }
}

/**
 * Returns all paired chats for admin listing.
 */
export async function listPaired(db: D1Client): Promise<PairedChat[]> {
  const { data } = await db
    .from('telegram_paired_chats')
    .select('chat_id, first_name, paired_at, paired_by')

  if (!data) return []
  return data as unknown as PairedChat[]
}

/**
 * Removes a chat from the allowlist.
 * Returns true if a row was deleted, false if not found.
 */
export async function revokePairing(db: D1Client, chatId: string): Promise<boolean> {
  // Check existence first
  const { data } = await db
    .from('telegram_paired_chats')
    .select('chat_id')
    .eq('chat_id', chatId)
    .maybeSingle()

  if (!data) return false

  await db.from('telegram_paired_chats').delete().eq('chat_id', chatId)
  return true
}
