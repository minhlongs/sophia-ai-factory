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

import { getD1 } from '@/seed/db/client';
import { getActiveKeyVersion, decryptApiKey, encryptApiKey } from '@/tree/byok/byok-crypto'

/** All providers that can be stored in user_api_keys. 'heygen' is server-managed (not user-settable via admin UI). */
export type ByokProvider = 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'heygen' | 'muapi' | 'apollo' | 'hunter'

interface KeyRow {
 encrypted_key: ArrayBuffer | Uint8Array
 key_version: number | null
 key_validated_at?: number | null
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
  const _db = getD1();
  if (!_db) throw new Error('BYOK_D1_UNAVAILABLE');
  const d1 = _db;
  if (!d1) throw new Error('BYOK_D1_UNAVAILABLE')

  const encrypted = await encryptApiKey(plainKey, userId)
  const keyVersion = await getActiveKeyVersion()

  await d1
    .prepare(
      `INSERT INTO user_api_keys (user_id, provider, encrypted_key, key_version, key_validated_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, provider) DO UPDATE SET
         encrypted_key = excluded.encrypted_key,
         key_version = excluded.key_version,
         key_validated_at = excluded.key_validated_at,
         updated_at    = datetime('now')`,
    )
    .bind(userId, provider, encrypted, keyVersion, Date.now())
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
  const _db = getD1();
  if (!_db) return null; // Graceful degrade: no D1 → null (fallback to env)
  const d1 = _db;

  try {
    const row = await d1
      .prepare(
        `SELECT encrypted_key, key_version FROM user_api_keys
         WHERE user_id = ? AND provider = ? LIMIT 1`,
      )
      .bind(userId, provider)
      .first<KeyRow>()

    if (!row?.encrypted_key) return null
    return await decryptApiKey(
      toBytes(row.encrypted_key),
      userId,
      row.key_version ?? undefined,
      row.key_version == null,
    )
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
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const d1 = _db;
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
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const d1 = _db;
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
