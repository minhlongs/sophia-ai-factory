/**
 * HeyGen Webhook Event Handlers
 * Layer: land/webhooks/heygen
 */

import { NextResponse } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { createServerClient } from '@/seed/db/client'
import {
  completeVideoFromWebhook,
  failVideoFromWebhook,
  type HeyGenSuccessData,
  type HeyGenFailData,
} from '@/land/fulfillment/complete-video-from-webhook'
import { normalizeStatus, type HeyGenWebhookPayload } from './types'
import { handleOnboardingDelivery } from './onboarding-delivery'

export async function processHeyGenPayload(
  payload: HeyGenWebhookPayload,
  heygenJobId: string | undefined,
  ownerUserId: string | null,
): Promise<NextResponse> {
  const eventType = payload.event_type ?? ''
  logger.info('[heygen-webhook] Received event', { event_type: eventType, heygenJobId })

  // ── Fulfillment state machine events (F4) ─────────────────────────────────
  if (eventType === 'avatar_video.success') {
    const d = (payload.event_data ?? payload) as Record<string, unknown>
    await completeVideoFromWebhook({
      video_id: String(d.video_id ?? ''),
      video_url: String(d.video_url ?? ''),
      thumbnail_url: typeof d.thumbnail_url === 'string' ? d.thumbnail_url : undefined,
      duration: typeof d.duration === 'number' ? d.duration : undefined,
    } as HeyGenSuccessData, ownerUserId)

    await handleOnboardingDelivery(String(d.video_id ?? ''), String(d.video_url ?? ''), ownerUserId)
    return NextResponse.json({ ok: true })
  }

  if (eventType === 'avatar_video.fail') {
    const d = (payload.event_data ?? payload) as Record<string, unknown>
    await failVideoFromWebhook({
      video_id: String(d.video_id ?? ''),
      error: typeof d.error === 'string' ? d.error : undefined,
    } as HeyGenFailData, ownerUserId)
    return NextResponse.json({ ok: true })
  }

  // ── Legacy flat-structure events ──────────────────────────────────────────
  if (!heygenJobId) {
    logger.info('[heygen-webhook] No video_id — ignoring unknown event', { event_type: eventType })
    return NextResponse.json({ ok: true, ignored: 'no_video_id' })
  }

  const status = normalizeStatus(payload.status)
  if (status === 'processing') {
    return NextResponse.json({ ok: true, ignored: 'non_terminal' })
  }

  try {
    const db = createServerClient()
    const update = db
      .from('videos')
      .update({
        status,
        video_url: payload.video_url ?? null,
        thumbnail_url: payload.thumbnail_url ?? null,
        duration_sec: typeof payload.duration === 'number' ? payload.duration : null,
        error: payload.error ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('heygen_job_id', heygenJobId)

    if (ownerUserId) {
      await update.eq('user_id', ownerUserId)
    } else {
      await update
    }

    logger.info('[heygen-webhook] Legacy status update', { heygenJobId, status, ownerUserId })

    if (status === 'completed') {
      await handleOnboardingDelivery(heygenJobId, payload.video_url, ownerUserId)
    }
  } catch (err) {
    logger.error('[heygen-webhook] D1 update failed', err instanceof Error ? err : undefined, {
      heygenJobId,
    })
  }

  return NextResponse.json({ ok: true })
}
