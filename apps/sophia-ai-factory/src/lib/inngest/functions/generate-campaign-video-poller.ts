/**
 * Video generation polling loop for generate-campaign Inngest function
 * @module inngest/functions/generate-campaign-video-poller
 */

import { checkVideoGenerationStatus } from '@/lib/ai/video-generator'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'
import { CampaignStatus, type Tier } from '@/types'

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return msg.includes('network') || msg.includes('503') || msg.includes('timeout') || msg.includes('econnreset')
}

export async function pollVideoStatus(
  videoJobId: string,
  tier: Tier,
  campaignId: string,
  callbacks: {
    onUpdate: (status: CampaignStatus, progress: number, data?: Record<string, unknown>) => Promise<void>
    onNotify: (msg: string) => Promise<void>
    topic: string
  }
): Promise<{ video_url: string; thumbnail_url: string }> {
  const { onUpdate, onNotify, topic } = callbacks
  const maxAttempts = 120
  const pollIntervalMs = 5000
  let attempts = 0

  while (attempts < maxAttempts) {
    let status: Awaited<ReturnType<typeof checkVideoGenerationStatus>>
    try {
      status = await checkVideoGenerationStatus(videoJobId, tier)
    } catch (err) {
      if (isTransientError(err)) {
        logger.warn(`[poll-video-status] Transient error on attempt ${attempts}, retrying once`, { campaignId })
        await new Promise(r => setTimeout(r, pollIntervalMs))
        try {
          status = await checkVideoGenerationStatus(videoJobId, tier)
        } catch (retryErr) {
          logger.error(`[poll-video-status] Retry also failed`, retryErr instanceof Error ? retryErr : undefined, { campaignId })
          await new Promise(r => setTimeout(r, pollIntervalMs))
          attempts++
          continue
        }
      } else {
        const errMsg = getErrorMessage(err)
        logger.error(`[poll-video-status] Permanent error`, err instanceof Error ? err : undefined, { campaignId })
        await onUpdate('failed', 70, { error_message: errMsg })
        await onNotify(`❌ **Sophia AI**: Video generation failed for "${topic}". Error: ${errMsg}`)
        throw new Error(errMsg)
      }
    }

    if (status!.status === 'completed' && status!.output) return status!.output
    if (status!.status === 'failed') {
      const errMsg = status!.error || 'Video generation failed'
      logger.error(`[poll-video-status] HeyGen reported failure`, { campaignId, error: errMsg })
      await onUpdate('failed', 70, { error_message: errMsg })
      await onNotify(`❌ **Sophia AI**: Video generation failed for "${topic}". Error: ${errMsg}`)
      throw new Error(errMsg)
    }

    await new Promise(r => setTimeout(r, pollIntervalMs))
    attempts++
  }

  logger.warn(`[poll-video-status] Timed out after ${maxAttempts} attempts`, { campaignId })
  await onUpdate('video_timeout' as CampaignStatus, 70, { error_message: 'Video generation timed out after 10 minutes' })
  await onNotify(`⏱️ **Sophia AI**: Video generation for "${topic}" timed out. Please retry or contact support.`)
  throw new Error('Video generation timed out after 10 minutes')
}
