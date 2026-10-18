/**
 * User API Key Store — Delete & List Queries (Phase 4G-BYOK).
 *
 * Co-located helper module for `user-api-key-store.ts`.
 */

import { getD1 } from '@/seed/db/client'
import type { ByokProvider } from '@/tree/byok/user-api-key-store'

/**
 * Remove a stored key. Idempotent — no-op on missing row.
 * Throws on missing D1 (surfaces to admin UI).
 */
export async function clearUserApiKey(
  userId: string,
  provider: ByokProvider,
): Promise<void> {
  if (!userId || !provider) throw new Error('BYOK_CLEAR_INVALID_ARGS')
  const _db = await getD1()
  if (!_db) throw new Error('D1 binding not available')
  const d1 = _db
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
  const _db = await getD1()
  if (!_db) throw new Error('D1 binding not available')
  const d1 = _db
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
