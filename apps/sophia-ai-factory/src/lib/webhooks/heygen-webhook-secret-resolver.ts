/**
 * Per-customer HeyGen webhook secret resolver.
 *
 * P0.1 fix: each customer registers their own HeyGen webhook with their own secret.
 * Looks up the video owner's user_id via heygen_job_id, then fetches their stored
 * heygen_webhook_secret from user_provider_credentials. Falls back to platform
 * HEYGEN_WEBHOOK_SECRET for transitional support (existing customers without BYOK).
 *
 * @module lib/webhooks/heygen-webhook-secret-resolver
 */

import { logger } from '@/lib/utils/logger-utility'
import { createServerClient } from '@/lib/db/client'
import { getUserCredential } from '@/lib/credentials/user-credentials-repo'

interface VideoOwnerRow {
  user_id: string
}

/**
 * Resolve the HMAC secret to use for a HeyGen webhook event.
 *
 * Resolution order:
 *   1. Lookup video owner by heygen_job_id
 *   2. Return user's stored heygen_webhook_secret (if present)
 *   3. Fall back to HEYGEN_WEBHOOK_SECRET platform env
 *   4. Return null if neither exists → caller uses cron-poll fallback
 */
export async function resolveHeyGenWebhookSecret(
  heygenJobId: string | undefined,
): Promise<string | null> {
  const platformSecret = process.env.HEYGEN_WEBHOOK_SECRET ?? null

  if (!heygenJobId) return platformSecret

  try {
    const db = createServerClient()
    const { data: videoRow } = await db
      .from('videos')
      .select('user_id')
      .eq('heygen_job_id', heygenJobId)
      .single() as { data: VideoOwnerRow | null }

    if (videoRow?.user_id) {
      const userSecret = await getUserCredential(videoRow.user_id, 'heygen_webhook_secret')
      if (userSecret) return userSecret
    }
  } catch (err) {
    logger.warn('[heygen-webhook] secret resolver lookup failed — using platform fallback', {
      heygenJobId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return platformSecret
}
