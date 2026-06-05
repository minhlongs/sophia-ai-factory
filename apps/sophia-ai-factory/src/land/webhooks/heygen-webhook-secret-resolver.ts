/**
 * Per-customer HeyGen webhook secret resolver.
 *
 * Each customer registers their own HeyGen webhook with their own secret.
 * Looks up the video owner's user_id via heygen_job_id, then fetches their
 * stored heygen_webhook_secret from user_provider_credentials. Falls back to
 * platform HEYGEN_WEBHOOK_SECRET for transitional support.
 *
 * Returns both the secret AND the resolved owner user_id so callers can
 * scope subsequent D1 writes by (heygen_job_id, user_id) — preventing a
 * malicious tenant from forging a webhook for another tenant's job_id.
 *
 * @module lib/webhooks/heygen-webhook-secret-resolver
 */

import { logger } from '@/seed/utils/logger-utility'
import { createServerClient } from '@/seed/db/client'
import { ByokKeyRotatedError, getUserCredential } from '@/tree/credentials/user-credentials-repo'

interface VideoOwnerRow {
  user_id: string
}

export interface HeyGenSecretResolution {
  /** HMAC secret to verify the signature with, or null if neither BYOK nor platform secret configured. */
  secret: string | null
  /** Resolved owner user_id when the job_id maps to a known video row. */
  ownerUserId: string | null
  /** Whether the resolved secret came from the user's BYOK credential (vs platform env). */
  isUserScoped: boolean
}

/**
 * Resolve the HMAC secret and owner for a HeyGen webhook event.
 *
 * Resolution order:
 *   1. Lookup video owner by heygen_job_id → ownerUserId
 *   2. Fetch user's heygen_webhook_secret (isUserScoped=true)
 *   3. Fall back to HEYGEN_WEBHOOK_SECRET platform env (isUserScoped=false)
 *   4. Return secret=null if neither exists — caller uses cron-poll fallback
 */
export async function resolveHeyGenWebhookSecret(
  heygenJobId: string | undefined,
): Promise<HeyGenSecretResolution> {
  const platformSecret = process.env.HEYGEN_WEBHOOK_SECRET ?? null

  if (!heygenJobId) {
    return { secret: platformSecret, ownerUserId: null, isUserScoped: false }
  }

  try {
    const db = createServerClient()
    const { data: videoRow } = await db
      .from('videos')
      .select('user_id')
      .eq('heygen_job_id', heygenJobId)
      .single() as { data: VideoOwnerRow | null }

    if (videoRow?.user_id) {
      const userSecret = await getUserCredential(videoRow.user_id, 'heygen_webhook_secret')
      if (userSecret) {
        return { secret: userSecret, ownerUserId: videoRow.user_id, isUserScoped: true }
      }
      return { secret: platformSecret, ownerUserId: videoRow.user_id, isUserScoped: false }
    }
  } catch (err) {
    logger.warn('[heygen-webhook] secret resolver lookup failed — using platform fallback', {
      heygenJobId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return { secret: platformSecret, ownerUserId: null, isUserScoped: false }
}
