/**
 * BYOK resolver — Phase 4G-BYOK.
 *
 * Thin indirection for callers that want to "try user key first, fall
 * back to env". Keeps existing env-driven callers working when a user
 * has no key stored, while opting-in users get their own key used.
 *
 * Gated by `BYOK_ENABLED=1`. When off, always returns `envFallback` —
 * the table is inert and the store is never queried.
 *
 * Contract:
 *   - BYOK off              → envFallback
 *   - BYOK on, user has key → user's decrypted key
 *   - BYOK on, user missing → envFallback
 *   - BYOK on, no user      → envFallback (e.g. cron with no userId)
 */

import { getUserApiKey, type ByokProvider } from './user-api-key-store'

export function isByokEnabled(): boolean {
  return process.env.BYOK_ENABLED === '1'
}

export async function resolveUserApiKey(
  userId:       string | null | undefined,
  provider:     ByokProvider,
  envFallback?: string,
): Promise<string | null> {
  const fallback = envFallback ?? null

  if (!isByokEnabled())       return fallback
  if (!userId)                return fallback

  const userKey = await getUserApiKey(userId, provider)
  return userKey ?? fallback
}

export type { ByokProvider } from './user-api-key-store'
