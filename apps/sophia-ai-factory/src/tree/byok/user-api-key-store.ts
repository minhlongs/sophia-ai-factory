/**
 * User API Key Store — Phase 4G-BYOK.
 *
 * CRUD operations over the `user_api_keys` D1 table. All reads return
 * plaintext; all writes encrypt before upsert. The convenience reader
 * (`getUserApiKey`) swallows to null to keep existing callers graceful,
 * but `lookupUserApiKey` preserves the distinction between an absent key
 * and a failed store, which is what protected consumers rely on to fail
 * closed. Write failures throw (user-facing admin action).
 *
 * Plaintext keys never cross this module boundary in persisted form.
 */

import { getD1 } from '@/seed/db/client'
import { getActiveKeyVersion, decryptApiKey, encryptApiKey } from '@/tree/byok/byok-crypto'

export { clearUserApiKey, listUserApiKeyProviders } from '@/tree/byok/user-api-key-store-queries'

/** All providers that can be stored in user_api_keys. 'heygen' is server-managed (not user-settable via admin UI). */
export type ByokProvider = 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'heygen' | 'replicate' | 'muapi' | 'apollo' | 'hunter' | 'fal-ai'

interface KeyRow {
  encrypted_key: ArrayBuffer | Uint8Array
  key_version: number | null
  key_validated_at?: number | null
}

export type UserApiKeyLookupResult =
  | { status: 'FOUND'; key: string }
  | { status: 'NOT_CONFIGURED' }
  | { status: 'STORE_UNAVAILABLE' }
  | { status: 'DECRYPT_FAILED' }
  | { status: 'KEY_VERSION_UNSUPPORTED' }

function toBytes(blob: ArrayBuffer | Uint8Array): Uint8Array {
  return blob instanceof Uint8Array ? blob : new Uint8Array(blob)
}

/**
 * Upsert a user's API key. Idempotent — re-calling rotates the stored key.
 * Throws on missing D1 or missing BYOK_MASTER_KEY (caller must surface).
 */
export async function setUserApiKey(
  userId: string,
  provider: ByokProvider,
  plainKey: string,
): Promise<void> {
  if (!userId || !provider || !plainKey) {
    throw new Error('BYOK_SET_INVALID_ARGS')
  }
  const _db = await getD1()
  if (!_db) throw new Error('BYOK_D1_UNAVAILABLE')
  const d1 = _db

  const encrypted = await encryptApiKey(plainKey, userId)
  const keyVersion = await getActiveKeyVersion()

  try {
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
  } catch (err: unknown) {
    if (String(err).includes('key_validated_at')) {
      await d1
        .prepare(
          `INSERT INTO user_api_keys (user_id, provider, encrypted_key, key_version, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(user_id, provider) DO UPDATE SET
             encrypted_key = excluded.encrypted_key,
             key_version = excluded.key_version,
             updated_at    = datetime('now')`,
        )
        .bind(userId, provider, encrypted, keyVersion)
        .run()
    } else {
      throw err
    }
  }
}

/** Read and decrypt a key while preserving absence vs infrastructure/crypto failure. */
export async function lookupUserApiKey(
  userId: string,
  provider: ByokProvider,
): Promise<UserApiKeyLookupResult> {
  if (!userId || !provider) return { status: 'NOT_CONFIGURED' }

  let d1
  try {
    d1 = await getD1()
  } catch {
    return { status: 'STORE_UNAVAILABLE' }
  }
  if (!d1) return { status: 'STORE_UNAVAILABLE' }

  let row: KeyRow | null
  try {
    row = await d1
      .prepare(
        `SELECT encrypted_key, key_version FROM user_api_keys
         WHERE user_id = ? AND provider = ? LIMIT 1`,
      )
      .bind(userId, provider)
      .first<KeyRow>()
  } catch {
    return { status: 'STORE_UNAVAILABLE' }
  }

  if (!row?.encrypted_key) return { status: 'NOT_CONFIGURED' }

  try {
    const key = await decryptApiKey(
      toBytes(row.encrypted_key),
      userId,
      row.key_version ?? undefined,
      row.key_version == null,
    )
    return { status: 'FOUND', key }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('BYOK_DECRYPT_VERSION_UNSUPPORTED')) {
        return { status: 'KEY_VERSION_UNSUPPORTED' }
      }
      if (error.message === 'BYOK_KEY_VERSION_STORE_UNAVAILABLE') {
        return { status: 'STORE_UNAVAILABLE' }
      }
    }
    return { status: 'DECRYPT_FAILED' }
  }
}

/**
 * Compatibility wrapper for direct consumers, kept non-throwing so existing
 * callers keep the graceful behavior they were written against.
 *
 * Callers that must distinguish "no key" from "the store failed" — and fail
 * closed on the latter — should call {@link lookupUserApiKey} directly: this
 * wrapper collapses every non-FOUND status to `null`.
 */
export async function getUserApiKey(
  userId: string,
  provider: ByokProvider,
): Promise<string | null> {
  const result = await lookupUserApiKey(userId, provider)
  return result.status === 'FOUND' ? result.key : null
}
