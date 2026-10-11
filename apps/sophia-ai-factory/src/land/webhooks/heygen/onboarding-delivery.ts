/**
 * HeyGen Webhook Onboarding Delivery
 * Layer: land/webhooks/heygen
 */

import { logger } from '@/seed/utils/logger-utility'
import { createServerClient } from '@/seed/db/client'
import { sendOnboardingVideoEmail } from '@/tree/email/onboarding-emails'

export async function handleOnboardingDelivery(
  heygenVideoId: string,
  videoUrl: string | undefined,
  ownerUserId: string | null,
): Promise<void> {
  if (!ownerUserId) {
    logger.warn('[heygen-webhook] Onboarding delivery skipped — no owner resolved', { heygenVideoId })
    return
  }
  try {
    const db = createServerClient()
    const { data: video } = (await db
      .from('videos')
      .select('id, user_id, is_onboarding')
      .eq('heygen_job_id', heygenVideoId)
      .eq('user_id', ownerUserId)
      .single()) as { data: { id: string; user_id: string; is_onboarding: number } | null }

    if (video?.is_onboarding) {
      await db
        .from('video_onboarding_events')
        .update({
          delivery_status: 'delivered',
          delivered_at: Math.floor(Date.now() / 1000),
          video_id: video.id,
        })
        .eq('video_id', video.id)

      sendOnboardingVideoEmail(video.user_id, video.id, videoUrl).catch((err) => {
        logger.warn('[heygen-webhook] Onboarding email failed (non-fatal)', {
          videoId: video.id,
          error: String(err),
        })
      })
    }
  } catch (err) {
    logger.warn('[heygen-webhook] Onboarding delivery check failed (non-fatal)', {
      heygenVideoId,
      error: String(err),
    })
  }
}
