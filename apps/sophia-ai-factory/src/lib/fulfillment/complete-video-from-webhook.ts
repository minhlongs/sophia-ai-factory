/**
 * Transactional handlers for HeyGen webhook events.
 * Called from /api/webhooks/heygen when HeyGen pushes status updates.
 * Both handlers are idempotent — safe to call multiple times for same job.
 *
 * M2 fix: recordAttemptCAS + markPermanentFailureCAS use WHERE state-guard
 *   so concurrent webhook + cron calls don't double-count or double-email.
 * M4 fix: completeVideoFromWebhook checks purchase status before sending
 *   ready email — skips if purchase is refunded.
 *
 * @module lib/fulfillment/complete-video-from-webhook
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { getD1Raw, createServerClient } from '@/seed/db/client'
import { downloadAndStore } from '@/lib/video/video-storage-service'
import { sendOneTimeBundleReadyEmail } from '@/lib/billing/email/send-one-time-bundle-ready-email'
import { getUserCredits } from '@/seed/db/get-user-credits'
import { grantCompensationCredit } from '@/lib/fulfillment/compensation'
import { sendBundleRenderFailedEmail } from '@/lib/billing/email/send-bundle-render-failed-email'
import {
  findByHeygenJobId,
  markPermanentFailureCAS,
  recordAttemptCAS,
} from '@/seed/db/repositories/videos-repo'
import { MAX_ATTEMPTS } from '@/lib/fulfillment/retry-backoff'
import { recordHeyGenAttempt } from '@/lib/fulfillment/circuit-breaker'

// ── Types ───────────────────────────────────────────────────────────────────

export interface HeyGenSuccessData {
  video_id: string
  video_url: string
  thumbnail_url?: string
  duration?: number
}

export interface HeyGenFailData {
  video_id: string
  error?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface UserRow {
  email?: string
  locale?: string
}

async function fetchUserInfo(userId: string): Promise<{ email: string; locale: string } | null> {
  try {
    const db = createServerClient()
    const { data } = await db
      .from('user')
      .select('email, locale')
      .eq('id', userId)
      .single()
    const row = data as UserRow | null
    if (!row?.email) return null
    return { email: row.email, locale: row.locale ?? 'vi' }
  } catch (err) {
    logger.error('[WebhookComplete] fetchUserInfo failed', err instanceof Error ? err : undefined, { userId })
    return null
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Handle avatar_video.success webhook event.
 * Updates video row to completed, copies to R2, sends ready email.
 * Idempotent: no-op if row already in terminal state.
 *
 * M4 fix: skips ready email if linked purchase is refunded.
 */
export async function completeVideoFromWebhook(data: HeyGenSuccessData): Promise<void> {
  const { video_id: heygenJobId, video_url: videoUrl, thumbnail_url: thumbnailUrl } = data

  const row = await findByHeygenJobId(heygenJobId)
  if (!row) {
    logger.warn('[WebhookComplete] Unknown heygen_job_id', { heygenJobId })
    return
  }

  // Idempotency — already terminal
  if (row.status === 'completed' || row.status === 'failed_permanent') {
    logger.info('[WebhookComplete] Already in terminal state, skipping', {
      videoId: row.id,
      status: row.status,
    })
    return
  }

  const d1 = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  // Copy to R2 (best-effort)
  let r2Key: string | null = null
  let r2SizeBytes: number | null = null
  try {
    const stored = await downloadAndStore(videoUrl, row.id, `videos/${row.user_id}/${row.id}.mp4`)
    r2Key = stored.path
    r2SizeBytes = stored.sizeBytes
  } catch (r2Err) {
    logger.warn('[WebhookComplete] R2 copy failed — keeping HeyGen URL', {
      videoId: row.id,
      error: getErrorMessage(r2Err),
    })
  }

  await d1
    .prepare(
      `UPDATE videos
       SET status = 'completed',
           video_url = ?2,
           thumbnail_url = ?3,
           r2_key = ?4,
           r2_size_bytes = ?5,
           updated_at = ?6
       WHERE id = ?1`,
    )
    .bind(row.id, videoUrl, thumbnailUrl ?? null, r2Key, r2SizeBytes, now)
    .run()

  // Record HeyGen success so circuit breaker observes all outcomes
  try { await recordHeyGenAttempt(true) } catch { /* non-fatal */ }

  logger.info('[WebhookComplete] Video marked completed', { videoId: row.id, heygenJobId })

  // Send ready email (only for one-time bundle purchases)
  if (!row.purchase_id) return

  try {
    // M4: check if purchase was refunded before sending ready email
    const clientDb = createServerClient()
    const { data: purchaseData } = await clientDb
      .from('user_purchases')
      .select('status')
      .eq('id', row.purchase_id)
      .single()
    const purchase = purchaseData as { status?: string } | null

    if (purchase?.status === 'refunded') {
      logger.info('[WebhookComplete] Skipping ready email — purchase refunded', {
        videoId: row.id,
        purchaseId: row.purchase_id,
      })
      return
    }

    const userInfo = await fetchUserInfo(row.user_id)
    if (!userInfo) return

    const { creditsRemaining } = await getUserCredits(row.user_id)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'
    const videoPageUrl = r2Key
      ? `${appUrl}/dashboard/orders`
      : videoUrl

    await sendOneTimeBundleReadyEmail({
      userEmail: userInfo.email,
      userId: row.user_id,
      purchaseId: row.purchase_id,
      creditsRemaining,
      videoUrl: videoPageUrl,
      locale: userInfo.locale,
    })
  } catch (emailErr) {
    logger.warn('[WebhookComplete] Ready email failed (non-fatal)', {
      videoId: row.id,
      error: getErrorMessage(emailErr),
    })
  }
}

/**
 * Handle avatar_video.fail webhook event.
 * Bumps attempt_count via CAS. If >= MAX_ATTEMPTS → permanent failure + compensation.
 * Idempotent: no-op if already terminal.
 *
 * M2 fix: uses recordAttemptCAS + markPermanentFailureCAS to prevent double
 * email + double compensation when webhook + cron race on the same row.
 */
export async function failVideoFromWebhook(data: HeyGenFailData): Promise<void> {
  const { video_id: heygenJobId, error: errorMsg } = data

  const row = await findByHeygenJobId(heygenJobId)
  if (!row) {
    logger.warn('[WebhookFail] Unknown heygen_job_id', { heygenJobId })
    return
  }

  if (row.status === 'completed' || row.status === 'failed_permanent') {
    logger.info('[WebhookFail] Already in terminal state, skipping', {
      videoId: row.id,
      status: row.status,
    })
    return
  }

  const errorText = errorMsg ?? 'webhook_fail'
  const nextAttemptCount = row.attempt_count + 1

  // Record HeyGen failure so circuit breaker observes webhook-reported failures
  try { await recordHeyGenAttempt(false) } catch { /* non-fatal */ }

  if (nextAttemptCount >= MAX_ATTEMPTS) {
    // CAS: only the winner of the race sends email + grants compensation
    const won = await markPermanentFailureCAS(row.id, errorText, nextAttemptCount - 1)
    if (!won) {
      logger.info('[WebhookFail] CAS lost — another caller already marked permanent failure', {
        videoId: row.id,
      })
      return
    }

    logger.warn('[WebhookFail] Permanent failure after max attempts', {
      videoId: row.id,
      attempts: nextAttemptCount,
      error: errorText,
    })

    if (row.purchase_id) {
      await grantCompensationCredit(row.purchase_id, 'render_failed_permanent')

      const userInfo = await fetchUserInfo(row.user_id)
      await sendBundleRenderFailedEmail({
        userEmail: userInfo?.email,
        userId: row.user_id,
        purchaseId: row.purchase_id,
        locale: userInfo?.locale ?? row.locale ?? 'vi',
      })
    }
  } else {
    // CAS: increment attempt_count only when still in 'queued' state
    const newCount = await recordAttemptCAS(row.id, errorText)
    if (newCount === null) {
      logger.info('[WebhookFail] CAS lost — row already transitioned, skipping recordAttempt', {
        videoId: row.id,
      })
      return
    }

    logger.warn('[WebhookFail] Attempt recorded, retry cron will requeue', {
      videoId: row.id,
      attempt: newCount,
      error: errorText,
    })
  }
}
