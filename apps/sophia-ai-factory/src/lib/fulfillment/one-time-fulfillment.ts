/**
 * One-Time bundle fulfillment — triggers video gen + email delivery after purchase.
 * Called synchronously from nowpayments-ipn-one-time.ts after purchase row is marked paid.
 * Non-fatal: caller wraps in try/catch.
 *
 * @module lib/fulfillment/one-time-fulfillment
 */

import { logger } from '@/lib/utils/logger-utility'
import { createServerClient } from '@/lib/db/client'
import { createHeyGenVideo } from '@/lib/video/heygen-helpers'
import { getOneTimeWelcomeScript } from '@/lib/video/one-time-welcome-script'
import { getUserCredits } from '@/lib/db/get-user-credits'
import type { OneTimeSku } from '@/types'

interface UserRow {
  email?: string
  locale?: string
}

/**
 * Trigger fulfillment for a completed one-time bundle purchase:
 * 1. Fetch user email + locale
 * 2. Generate HeyGen welcome video
 * 3. Insert videos row with purchase_id linkage
 * Email is sent by the video-status-sync cron when HeyGen reports completed.
 */
export async function triggerOneTimeFulfillment(
  userId: string,
  purchaseId: string,
  sku: OneTimeSku,
): Promise<void> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    logger.warn('[OneTimeFulfillment] No HEYGEN_API_KEY — skipping video gen', {
      userId,
      purchaseId,
    })
    return
  }

  const db = createServerClient()

  // Fetch user email + locale
  const { data: userData } = await db
    .from('user')
    .select('email, locale')
    .eq('id', userId)
    .single()
  const user = userData as UserRow | null
  const userEmail = user?.email ?? ''
  const locale = user?.locale ?? 'vi'

  if (!userEmail) {
    logger.warn('[OneTimeFulfillment] User has no email — cannot fulfill', { userId })
    return
  }

  // Generate welcome video
  const script = getOneTimeWelcomeScript(sku, locale)
  const title = `Welcome Bundle — ${sku.id} — ${userId.slice(0, 8)}`

  let heygenJobId: string
  try {
    const result = await createHeyGenVideo({ script, title, apiKey })
    heygenJobId = result.videoId
  } catch (err) {
    logger.error('[OneTimeFulfillment] HeyGen createVideo failed', err instanceof Error ? err : undefined, {
      userId,
      purchaseId,
    })
    return
  }

  // Insert videos row linked to purchase
  const now = Math.floor(Date.now() / 1000)
  const { data: videoData } = await db
    .from('videos')
    .insert({
      user_id: userId,
      purchase_id: purchaseId,
      heygen_job_id: heygenJobId,
      title,
      status: 'processing',
      is_onboarding: 0,
      created_at: now,
    })
    .select('id')
    .single()

  const videoId = (videoData as { id?: string } | null)?.id

  // Fetch current credit balance (for email context when cron fires)
  const { creditsRemaining } = await getUserCredits(userId)

  logger.info('[OneTimeFulfillment] Video queued', {
    userId,
    purchaseId,
    heygenJobId,
    videoId,
    creditsRemaining,
    userEmail,
    locale,
  })
}
