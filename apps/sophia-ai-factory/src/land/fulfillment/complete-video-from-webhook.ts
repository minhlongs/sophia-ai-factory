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
import { getD1, createServerClient } from '@/seed/db/client'
import { downloadAndStore } from '@/land/video/storage/video-storage-service'
import { sendOneTimeBundleReadyEmail } from '@/land/billing/email/send-one-time-bundle-ready-email'
import { getUserCredits } from '@/seed/db/get-user-credits'
import { grantCompensationCredit } from '@/land/fulfillment/compensation'
import { sendBundleRenderFailedEmail } from '@/land/billing/email/send-bundle-render-failed-email'
import {
  findByHeygenJobId,
  markPermanentFailureCAS,
  recordAttemptCAS,
  recordWebhookAttemptCAS,
  markWebhookPermanentFailureCAS,
} from '@/seed/db/repositories/videos-repo'
import { MAX_ATTEMPTS } from '@/land/fulfillment/retry-backoff'
import { recordHeyGenAttempt } from '@/seed/utils/circuit-breaker'

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
export async function completeVideoFromWebhook(
  data: HeyGenSuccessData,
  ownerUserId?: string | null,
): Promise<void> {
  const { video_id: heygenJobId, video_url: videoUrl, thumbnail_url: thumbnailUrl } = data

  const row = await findByHeygenJobId(heygenJobId, ownerUserId)
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

  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const now = Math.floor(Date.now() / 1000);

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

  // completed_at is set ONCE on terminal transition (P27 honest benchmark — migration 0113).
  // now is unix-epoch INTEGER; updated_at column happens to be TEXT, so we keep the existing
  // datetime('now') default by binding `now` as INTEGER cast to TEXT via SQLite implicit conversion.
  const nowEpoch = Math.floor(Date.now() / 1000)
  const result = await db
    .prepare(
      `UPDATE videos
       SET status = 'completed',
           video_url = ?2,
           thumbnail_url = ?3,
           r2_key = ?4,
           r2_size_bytes = ?5,
           updated_at = ?6,
           completed_at = COALESCE(completed_at, ?7)
       WHERE id = ?1 AND status != 'completed' AND status != 'failed_permanent'`,
    )
    .bind(row.id, videoUrl, thumbnailUrl ?? null, r2Key, r2SizeBytes, now, nowEpoch)
    .run()

  const updated = (result.meta?.changes ?? 0) > 0
  if (!updated) {
    logger.warn('[WebhookComplete] CAS lost — video already completed or failed permanently', {
      videoId: row.id,
    })
    return
  }

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
export async function failVideoFromWebhook(
  data: HeyGenFailData,
  ownerUserId?: string | null,
): Promise<void> {
  const { video_id: heygenJobId, error: errorMsg } = data

  const row = await findByHeygenJobId(heygenJobId, ownerUserId)
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
    const won = await markWebhookPermanentFailureCAS(row.id, errorText, nextAttemptCount - 1)
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
      const clientDb = createServerClient()
      const { data: purchaseData } = await clientDb.from('user_purchases').select('status').eq('id', row.purchase_id).single();
      const purchase = purchaseData as { status: string } | null
      if (purchase?.status === 'refunded') {
        logger.info('[WebhookFail] Skipping email and compensation — purchase refunded', { purchaseId: row.purchase_id });
        return;
      }
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
    // CAS: increment attempt_count only when still in 'processing' state
    const newCount = await recordWebhookAttemptCAS(row.id, errorText)
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
