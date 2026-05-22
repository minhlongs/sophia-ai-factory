/**
 * User Provider Credentials Repository
 *
 * CRUD over user_provider_credentials D1 table.
 * Encryption/decryption via lib/credentials/encryption (AES-GCM-256).
 * Plaintext keys never escape this module in persisted form.
 *
 * Providers: 'heygen' | 'heygen_webhook_secret' | 'resend' | 'nowpayments'
 *
 * @module lib/credentials/user-credentials-repo
 */

import { getD1Raw } from '@/seed/db/client'
import { encryptValue, decryptValue } from '@/tree/credentials/encryption'

export type ProviderType = 'heygen' | 'heygen_webhook_secret' | 'resend' | 'nowpayments' | 'local_llm' | 'kling' | 'assemblyai' | 'openai' | 'openrouter'

export interface CredentialSummary {
  provider: ProviderType
  display_hint: string | null
  status: 'active' | 'disabled' | 'revoked'
  last_used_at: number | null
}

interface CredentialRow {
  encrypted_value: string
  status: string
}

interface SummaryRow {
  provider: string
  display_hint: string | null
  status: string
  last_used_at: number | null
}

function makeDisplayHint(plaintext: string): string {
  if (plaintext.length <= 4) return '...' + plaintext
  return '...' + plaintext.slice(-4)
}

/**
 * Retrieve and decrypt a user's provider credential.
 * Updates last_used_at on successful read.
 * Returns null when row missing, key invalid, or D1 unavailable.
 */
export async function getUserCredential(
  userId: string,
  provider: ProviderType,
): Promise<string | null> {
  if (!userId || !provider) return null
  let d1: D1Database
  try {
    d1 = await getD1Raw()
  } catch {
    return null
  }

  try {
    const row = await d1
      .prepare(
        `SELECT encrypted_value, status FROM user_provider_credentials
         WHERE user_id = ?1 AND provider = ?2 LIMIT 1`,
      )
      .bind(userId, provider)
      .first<CredentialRow>()

    if (!row?.encrypted_value) return null
    if (row.status !== 'active') return null

    const plaintext = await decryptValue(row.encrypted_value, userId)

    // Fire-and-forget last_used_at update
    d1.prepare(
      `UPDATE user_provider_credentials
       SET last_used_at = strftime('%s', 'now')
       WHERE user_id = ?1 AND provider = ?2`,
    )
      .bind(userId, provider)
      .run()
      .catch(() => { /* non-fatal */ })

    return plaintext
  } catch {
    return null
  }
}

/**
 * Encrypt and upsert a user's provider credential.
 * Idempotent — re-calling rotates the stored value.
 * Throws on D1 unavailable or encryption failure (surfaces to admin UI).
 */
export async function setUserCredential(
  userId: string,
  provider: ProviderType,
  plaintext: string,
): Promise<void> {
  if (!userId || !provider || !plaintext) {
    throw new Error('setUserCredential: userId, provider and plaintext are required')
  }
  const d1 = await getD1Raw()
  const encryptedValue = await encryptValue(plaintext, userId)
  const displayHint = makeDisplayHint(plaintext)
  const now = Math.floor(Date.now() / 1000)

  await d1
    .prepare(
      `INSERT INTO user_provider_credentials
         (user_id, provider, encrypted_value, display_hint, created_at, updated_at, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5, 'active')
       ON CONFLICT(user_id, provider) DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         display_hint    = excluded.display_hint,
         updated_at      = excluded.updated_at,
         status          = 'active'`,
    )
    .bind(userId, provider, encryptedValue, displayHint, now)
    .run()
}

/**
 * Remove a stored credential. Idempotent -- no-op on missing row.
 */
export async function deleteUserCredential(
  userId: string,
  provider: ProviderType,
): Promise<void> {
  if (!userId || !provider) throw new Error('deleteUserCredential: userId and provider required')
  const d1 = await getD1Raw()
  await d1
    .prepare(`DELETE FROM user_provider_credentials WHERE user_id = ?1 AND provider = ?2`)
    .bind(userId, provider)
    .run()
}

/**
 * List credential metadata for a user (no plaintext exposed).
 */
export async function listUserProviders(userId: string): Promise<CredentialSummary[]> {
  if (!userId) return []
  let d1: D1Database
  try {
    d1 = await getD1Raw()
  } catch {
    return []
  }

  try {
    const { results } = await d1
      .prepare(
        `SELECT provider, display_hint, status, last_used_at
         FROM user_provider_credentials
         WHERE user_id = ?1 ORDER BY provider ASC`,
      )
      .bind(userId)
      .all<SummaryRow>()

    return (results ?? []).map((r) => ({
      provider: r.provider as ProviderType,
      display_hint: r.display_hint,
      status: r.status as CredentialSummary['status'],
      last_used_at: r.last_used_at,
    }))
  } catch {
    return []
  }
}
