/**
 * User API Key Store — Phase 4G-BYOK.
 *
 * CRUD operations over the `user_api_keys` D1 table. All reads return
 * plaintext; all writes encrypt before upsert. Errors swallow to null
 * for read paths (keep callers opt-in + graceful) but throw on write
 * failures (user-facing admin action).
 *
 * Plaintext keys never cross this module boundary in persisted form.
 */

import { getD1Raw } from '@/lib/auth/resolve-org-id'
import { decryptApiKey, encryptApiKey } from './byok-crypto'

export type ByokProvider = 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id'

interface KeyRow {
  encrypted_key: ArrayBuffer | Uint8Array
}

function toBytes(blob: ArrayBuffer | Uint8Array): Uint8Array {
  return blob instanceof Uint8Array ? blob : new Uint8Array(blob)
}

/**
 * Upsert a user's API key. Idempotent — re-calling rotates the stored key.
 * Throws on missing D1 or missing BYOK_MASTER_KEY (caller must surface).
 */
export async function setUserApiKey(
  userId:   string,
  provider: ByokProvider,
  plainKey: string,
): Promise<void> {
  if (!userId || !provider || !plainKey) {
    throw new Error('BYOK_SET_INVALID_ARGS')
  }
  const d1 = getD1Raw()
  if (!d1) throw new Error('BYOK_D1_UNAVAILABLE')

  const encrypted = await encryptApiKey(plainKey)

  await d1
    .prepare(
      `INSERT INTO user_api_keys (user_id, provider, encrypted_key, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, provider) DO UPDATE SET
         encrypted_key = excluded.encrypted_key,
         updated_at    = datetime('now')`,
    )
    .bind(userId, provider, encrypted)
    .run()
}

/**
 * Read and decrypt a user's API key. Returns `null` when:
 *   - row missing
 *   - BYOK_MASTER_KEY unset or invalid
 *   - auth tag fails (tampered row)
 *   - D1 throws
 *
 * All failure modes collapse to `null` so callers degrade to env fallback.
 */
export async function getUserApiKey(
  userId:   string,
  provider: ByokProvider,
): Promise<string | null> {
  if (!userId || !provider) return null
  const d1 = getD1Raw()
  if (!d1) return null

  try {
    const row = await d1
      .prepare(
        `SELECT encrypted_key FROM user_api_keys
         WHERE user_id = ? AND provider = ? LIMIT 1`,
      )
      .bind(userId, provider)
      .first<KeyRow>()

    if (!row?.encrypted_key) return null
    return await decryptApiKey(toBytes(row.encrypted_key))
  } catch {
    return null
  }
}

/**
 * Remove a stored key. Idempotent — no-op on missing row.
 * Throws on missing D1 (surfaces to admin UI).
 */
export async function clearUserApiKey(
  userId:   string,
  provider: ByokProvider,
): Promise<void> {
  if (!userId || !provider) throw new Error('BYOK_CLEAR_INVALID_ARGS')
  const d1 = getD1Raw()
  if (!d1) throw new Error('BYOK_D1_UNAVAILABLE')

  await d1
    .prepare(`DELETE FROM user_api_keys WHERE user_id = ? AND provider = ?`)
    .bind(userId, provider)
    .run()
}

/**
 * List providers for which a user has stored a key. Returns empty array
 * on failure. Used by /dashboard/api-keys UI (future).
 */
export async function listUserApiKeyProviders(
  userId: string,
): Promise<ByokProvider[]> {
  if (!userId) return []
  const d1 = getD1Raw()
  if (!d1) return []

  try {
    const { results } = await d1
      .prepare(
        `SELECT provider FROM user_api_keys WHERE user_id = ? ORDER BY provider ASC`,
      )
      .bind(userId)
      .all<{ provider: string }>()

    return (results ?? []).map((r) => r.provider as ByokProvider)
  } catch {
    return []
  }
}
