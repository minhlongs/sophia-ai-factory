/**
 * HeyGen Webhook Receiver
 *
 * Handles two event namespaces:
 *  1. avatar_video.success / avatar_video.fail  — fulfillment state machine (F4)
 *  2. Normalised status field (completed / failed) — legacy onboarding video delivery
 *
 * Public endpoint. Requires HMAC-SHA256 signature verification.
 *
 * P0.1 fix: per-customer webhook secret resolution via
 * lib/webhooks/heygen-webhook-secret-resolver.ts
 *
 * @module app/api/webhooks/heygen
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { createServerClient } from '@/seed/db/client'
import { verifyHeyGenSignature } from '@/lib/webhooks/heygen-signature-verifier'
import { resolveHeyGenWebhookSecret } from '@/lib/webhooks/heygen-webhook-secret-resolver'
import {
  completeVideoFromWebhook,
  failVideoFromWebhook,
  type HeyGenSuccessData,
  type HeyGenFailData,
} from '@/lib/fulfillment/complete-video-from-webhook'
import { sendOnboardingVideoEmail } from '@/forest/email/onboarding-emails'

export const dynamic = 'force-dynamic'

// ── Types ──────────────────────────────────────────────────────────────────

interface HeyGenWebhookPayload {
  event_type?: string
  event_data?: Record<string, unknown>
  video_id?: string
  status?: string
  video_url?: string
  thumbnail_url?: string
  duration?: number
  error?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeStatus(raw?: string): 'completed' | 'failed' | 'processing' {
  if (!raw) return 'processing'
  const s = raw.toLowerCase()
  if (s === 'success' || s === 'completed') return 'completed'
  if (s === 'error' || s === 'failed') return 'failed'
  return 'processing'
}

function resolveVideoId(payload: HeyGenWebhookPayload): string | undefined {
  if (payload.event_data && typeof payload.event_data === 'object') {
    const d = payload.event_data as Record<string, unknown>
    if (typeof d.video_id === 'string') return d.video_id
  }
  return payload.video_id
}

// ── Onboarding delivery ────────────────────────────────────────────────────

async function handleOnboardingDelivery(
  heygenVideoId: string,
  videoUrl: string | undefined,
  ownerUserId: string | null,
): Promise<void> {
  if (!ownerUserId) {
    // Without a resolved owner, we cannot safely scope the lookup —
    // skip rather than risk cross-tenant write on a colliding job_id.
    logger.warn('[heygen-webhook] Onboarding delivery skipped — no owner resolved', { heygenVideoId })
    return
  }
  try {
    const db = createServerClient()
    const { data: video } = await db
      .from('videos')
      .select('id, user_id, is_onboarding')
      .eq('heygen_job_id', heygenVideoId)
      .eq('user_id', ownerUserId)
      .single() as { data: { id: string; user_id: string; is_onboarding: number } | null }

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

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text()

  let payload: HeyGenWebhookPayload
  try {
    payload = JSON.parse(rawBody) as HeyGenWebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const heygenJobId = resolveVideoId(payload)

  // Resolve per-customer secret AND owner first (falls back to platform secret or null).
  // ownerUserId scopes all subsequent D1 writes to prevent a malicious tenant
  // forging a webhook for another tenant's heygen_job_id.
  const { secret, ownerUserId, isUserScoped } = await resolveHeyGenWebhookSecret(heygenJobId)

  if (!secret) {
    // Return 200 to suppress HeyGen retry storm. Cron polling handles fallback.
    logger.warn('[heygen-webhook] No webhook secret configured — cron-poll fallback active', {
      heygenJobId,
    })
    return NextResponse.json({ ok: true, mode: 'cron-poll-fallback' })
  }

  const sig =
    req.headers.get('signature') ??
    req.headers.get('x-heygen-signature') ??
    req.headers.get('heygen-signature') ??
    req.headers.get('x-signature') ??
    ''

  if (!sig) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 401 })
  }

  const valid = await verifyHeyGenSignature(rawBody, sig, secret)
  if (!valid) {
    logger.warn('[heygen-webhook] Invalid signature', { heygenJobId })
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

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
    } as HeyGenSuccessData)

    await handleOnboardingDelivery(String(d.video_id ?? ''), String(d.video_url ?? ''), ownerUserId)
    return NextResponse.json({ ok: true })
  }

  if (eventType === 'avatar_video.fail') {
    const d = (payload.event_data ?? payload) as Record<string, unknown>
    await failVideoFromWebhook({
      video_id: String(d.video_id ?? ''),
      error: typeof d.error === 'string' ? d.error : undefined,
    } as HeyGenFailData)
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

  // Legacy update path: scope by (heygen_job_id, user_id) when owner resolved.
  // If owner not resolved AND the verifying secret was platform-scoped, we can
  // still update by job_id alone (transitional fallback). If the verified secret
  // was user-scoped, ownerUserId is required.
  if (isUserScoped && !ownerUserId) {
    logger.warn('[heygen-webhook] User-scoped secret but no owner resolved — refusing update', { heygenJobId })
    return NextResponse.json({ ok: true, ignored: 'no_owner' })
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
