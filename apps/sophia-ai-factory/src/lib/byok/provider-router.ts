/**
 * Per-User BYOK Provider Router — Phase B
 *
 * Resolves a user's local-mode mekongd config from D1 + KV feature flag.
 * Returns null on ANY missing piece or error — callers fall back to cloud providers.
 *
 * Decision flow:
 *   1. userId must be truthy
 *   2. KV flag `local_mode_rollout` must be enabled for that user (% gating)
 *   3. User row in D1.users must have non-null local_mode_endpoint
 *   4. If local_mode_bearer_encrypted present → decrypt; on failure → null (fail-closed)
 *
 * Security:
 *   - Raw bearer NEVER stored in D1 — always AES-256-GCM ciphertext (Phase C).
 *   - Decrypt failure is warn-logged + treated as auth failure (fail-closed).
 *   - Props logged: userId, reason. Never logs endpoint or bearer.
 */

import { z } from 'zod'
import { createServerClient } from '@/lib/db/client'
import { isEnabled } from '@/lib/feature-flags'
import { decryptSecret } from '@/lib/crypto/encrypt-secret'

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCAL_MODE_FLAG = 'local_mode_rollout'

// ── D1 row schema (Zod) ───────────────────────────────────────────────────────

const LocalModeRowSchema = z.object({
  local_mode_endpoint: z.string().nullable(),
  local_mode_bearer_encrypted: z.string().nullable(),
})

type LocalModeRow = z.infer<typeof LocalModeRowSchema>

// ── Return type ───────────────────────────────────────────────────────────────

export interface LocalMekongdConfig {
  endpoint: string
  bearer?: string
}

// ── Core resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve a user's local-mode mekongd config.
 *
 * Returns `{ endpoint, bearer? }` when all gates pass, `null` otherwise.
 * Never throws — all errors are caught and return null.
 *
 * @param userId  Auth user ID from getCurrentUser(). Falsy → immediate null.
 */
export async function resolveLocalMekongdForUser(
  userId: string | null | undefined,
): Promise<LocalMekongdConfig | null> {
  // Gate 1: userId required
  if (!userId) return null

  // Gate 2: KV % rollout flag
  let flagEnabled: boolean
  try {
    flagEnabled = await isEnabled(LOCAL_MODE_FLAG, userId)
  } catch {
    // KV unavailable — fail closed
    return null
  }
  if (!flagEnabled) return null

  // Gate 3: D1 user row
  let row: LocalModeRow | null
  try {
    row = await fetchLocalModeRow(userId)
  } catch (err) {
    console.warn('[provider-router] D1 query error for userId=%s: %s', userId, String(err))
    return null
  }

  if (!row || !row.local_mode_endpoint) return null

  const endpoint = row.local_mode_endpoint

  // Gate 4: optional bearer decryption
  if (row.local_mode_bearer_encrypted) {
    let bearer: string
    try {
      bearer = await decryptSecret(row.local_mode_bearer_encrypted)
    } catch (err) {
      // Tampered ciphertext, wrong key, or key rotation mismatch — fail closed
      console.warn(
        '[provider-router] bearer decrypt failed for userId=%s — failing closed: %s',
        userId,
        String(err),
      )
      return null
    }
    return { endpoint, bearer }
  }

  return { endpoint }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Fetch the two local-mode columns for a user from D1.
 * Returns null when row not found. Throws on D1 error.
 */
async function fetchLocalModeRow(userId: string): Promise<LocalModeRow | null> {
  const db = createServerClient()

  const { data, error } = (await db
    .from('users')
    .select('local_mode_endpoint,local_mode_bearer_encrypted')
    .eq('id', userId)
    .maybeSingle()) as { data: unknown; error: unknown }

  if (error) throw new Error(`D1 error: ${String(error)}`)
  if (!data) return null

  // Zod-validate the row shape — never trust raw D1 output
  const parsed = LocalModeRowSchema.safeParse(data)
  if (!parsed.success) {
    console.warn('[provider-router] unexpected D1 row shape for userId=%s', userId)
    return null
  }

  return parsed.data
}
