/**
 * One-Time bundle fulfillment — queue-first video gen after purchase.
 * Always inserts a videos row BEFORE attempting HeyGen so no purchase
 * is silently lost if HeyGen is unavailable.
 *
 * Call flow:
 *   IPN handler → triggerOneTimeFulfillment
 *     1. Idempotency check (skip if videos row already exists)
 *     2. Enqueue videos row (status='queued')
 *     3. F6: Fire-and-forget "generating" email
 *     4. Attempt HeyGen createVideo (fail-soft — leaves row for retry cron)
 *
 * @module lib/fulfillment/one-time-fulfillment
 */

import { logger } from '@/seed/utils/logger-utility'
import { createServerClient } from '@/seed/db/client'
import { createHeyGenVideo } from '@/lib/video/heygen-helpers'
import { getHeyGenKey } from '@/tree/credentials/get-provider-key'
import { getOneTimeWelcomeScript } from '@/lib/video/one-time-welcome-script'
import {
  findByPurchaseId,
  enqueueVideo,
  markVideoProcessing,
  markVideoCompletedSynthetic,
  recordAttempt,
} from '@/seed/db/repositories/videos-repo'
import { sendBundleGeneratingEmail } from '@/land/billing/email/send-bundle-generating-email'
import { shouldDispatch, recordHeyGenAttempt } from '@/lib/fulfillment/circuit-breaker'
import { isSyntheticMonitoringUser } from '@/seed/config/synthetic-monitoring'
import type { OneTimeSku } from '@/seed/types'

interface UserRow {
  email?: string
  locale?: string
}

/**
 * Trigger fulfillment for a completed one-time bundle purchase.
 * Non-throwing: all errors are handled internally with retry-safe state.
 */
export async function triggerOneTimeFulfillment(
  userId: string,
  purchaseId: string,
  sku: OneTimeSku,
): Promise<void> {
  // Idempotency: skip if we already have a videos row for this purchase
  const existing = await findByPurchaseId(purchaseId)
  if (existing) {
    logger.info('[OneTimeFulfillment] Video row already exists, skipping enqueue', {
      purchaseId,
      videoId: existing.id,
      status: existing.status,
    })
    return
  }

  // Synthetic monitoring bypass: smoke-one-time cron inserts a fake purchase to
  // validate the chain end-to-end every 15 min. Real HeyGen call is impossible
  // here (no customer key + no-tech doctrine forbids operator key), so we mark
  // the video as completed synthetically. Smoke check at smoke-one-time/route.ts
  // expects videos.status='completed' before STALE_THRESHOLD_SEC.
  if (isSyntheticMonitoringUser(userId)) {
    try {
      const videoRowId = await enqueueVideo({
        userId,
        purchaseId,
        title: `Synthetic Monitoring — ${sku.id}`,
        script: 'synthetic-monitoring',
        locale: 'en',
      })
      await markVideoCompletedSynthetic(videoRowId)
      logger.info('[OneTimeFulfillment] Synthetic monitoring purchase fulfilled', {
        userId,
        purchaseId,
        videoRowId,
      })
    } catch (err) {
      logger.error('[OneTimeFulfillment] Synthetic monitoring enqueue failed', err instanceof Error ? err : undefined, {
        userId,
        purchaseId,
      })
    }
    return
  }

  // Fetch user email + locale (missing email does NOT block enqueue)
  const db = createServerClient()
  const { data: userData } = await db
    .from('user')
    .select('email, locale')
    .eq('id', userId)
    .single()
  const user = userData as UserRow | null
  const locale = user?.locale ?? 'vi'

  // Build script and title
  const script = getOneTimeWelcomeScript(sku, locale)
  const title = `Welcome Bundle — ${sku.id} — ${userId.slice(0, 8)}`

  // Enqueue — durable row created before any external call
  let videoRowId: string
  try {
    videoRowId = await enqueueVideo({ userId, purchaseId, title, script, locale })
  } catch (err) {
    logger.error('[OneTimeFulfillment] Failed to enqueue video row', err instanceof Error ? err : undefined, {
      userId,
      purchaseId,
    })
    return
  }

  // F6: Fire-and-forget "generating" email — set expectations before HeyGen call
  if (user?.email) {
    sendBundleGeneratingEmail({
      userEmail: user.email,
      userId,
      purchaseId,
      sku: sku.id,
      skuLabel: locale === 'vi' ? (sku.label_vi ?? sku.id) : (sku.label_en ?? sku.id),
      creditsTotal: sku.credits,
      locale,
    }).catch((emailErr) => {
      logger.error('[OneTimeFulfillment] Generating email failed (non-fatal)', emailErr instanceof Error ? emailErr : undefined, {
        userId,
        purchaseId,
      })
    })
  }

  // Circuit breaker check — if open, leave row as 'queued' for retry cron
  const dispatch = await shouldDispatch()
  if (!dispatch.allowed) {
    await recordAttempt(videoRowId, `circuit_open: ${dispatch.reason ?? 'unknown'}`)
    logger.warn('[OneTimeFulfillment] Circuit breaker blocked HeyGen dispatch', {
      videoRowId,
      purchaseId,
      reason: dispatch.reason,
    })
    return
  }

  // First attempt — fail-soft, retry cron picks up if this fails
  // Customer fulfillment MUST use the customer's own HeyGen key (fallbackToPlatform: false)
  const keyResult = await getHeyGenKey({ userId, fallbackToPlatform: false })
  if (!keyResult) {
    await recordAttempt(videoRowId, 'no_user_heygen_key')
    logger.warn('[OneTimeFulfillment] No user HeyGen key — video queued for retry', {
      videoRowId,
      purchaseId,
      userId,
    })
    return
  }
  const apiKey = keyResult.key

  // Only register callback URL in production to avoid preview-deploy webhooks
  const callbackUrl =
    process.env.NODE_ENV === 'production'
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/heygen`
      : undefined

  try {
    const { videoId: heygenJobId } = await createHeyGenVideo({ script, title, apiKey, callbackUrl })
    await markVideoProcessing(videoRowId, heygenJobId)
    await recordHeyGenAttempt(true)
    logger.info('[OneTimeFulfillment] HeyGen video submitted', {
      userId,
      purchaseId,
      heygenJobId,
      videoRowId,
    })
  } catch (err) {
    // Recoverable — leave status='queued', F2 retry cron will pick up
    const errMsg = err instanceof Error ? err.message : String(err)
    await recordAttempt(videoRowId, errMsg)
    await recordHeyGenAttempt(false)
    logger.error('[OneTimeFulfillment] HeyGen call failed — queued for retry', err instanceof Error ? err : undefined, {
      userId,
      purchaseId,
      videoRowId,
    })
  }
}
