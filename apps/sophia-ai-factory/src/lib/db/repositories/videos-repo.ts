/**
 * Videos repository — typed CRUD for video fulfillment state machine.
 * Supports queue-first pattern: insert as 'queued' before HeyGen call,
 * then transition to 'processing' on success or record failure for retry.
 *
 * @module lib/db/repositories/videos-repo
 */

import { getD1Raw } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'

export type VideoStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'failed_permanent'

export interface VideoRow {
  id: string
  user_id: string
  purchase_id: string | null
  heygen_job_id: string | null
  title: string
  status: VideoStatus
  script: string | null
  locale: string | null
  provider: string
  attempt_count: number
  last_attempt_at: number | null
  last_error: string | null
  created_at: number
}

export interface EnqueueVideoInput {
  userId: string
  purchaseId: string
  title: string
  script: string
  locale: string
  provider?: string
}

// ── Write operations ────────────────────────────────────────────────────────────

/**
 * Insert a new video row with status='queued'.
 * Returns the new row id.
 * Caller must check findByPurchaseId first for idempotency.
 */
export async function enqueueVideo(input: EnqueueVideoInput): Promise<string> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)
  const id = crypto.randomUUID()

  await db
    .prepare(
      `INSERT INTO videos
         (id, user_id, purchase_id, title, script, locale, provider, status,
          attempt_count, is_onboarding, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'queued', 0, 0, ?8)`,
    )
    .bind(id, input.userId, input.purchaseId, input.title, input.script, input.locale, input.provider ?? 'heygen', now)
    .run()

  return id
}

/**
 * Transition video row to 'processing' after HeyGen accepted the job.
 * Sets heygen_job_id, increments attempt_count, records last_attempt_at.
 */
export async function markVideoProcessing(videoId: string, heygenJobId: string): Promise<void> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  await db
    .prepare(
      `UPDATE videos
       SET status = 'processing',
           heygen_job_id = ?2,
           attempt_count = attempt_count + 1,
           last_attempt_at = ?3,
           last_error = NULL
       WHERE id = ?1`,
    )
    .bind(videoId, heygenJobId, now)
    .run()
}

/**
 * Record a failed attempt. Status stays 'queued' for retry cron pickup.
 * Increments attempt_count, stores last_error.
 *
 * Non-CAS variant: safe when there is only one caller (e.g. initial enqueue).
 * For concurrent webhook + cron paths, use recordAttemptCAS instead.
 */
export async function recordAttempt(videoId: string, errorMsg: string): Promise<void> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  await db
    .prepare(
      `UPDATE videos
       SET attempt_count = attempt_count + 1,
           last_attempt_at = ?2,
           last_error = ?3
       WHERE id = ?1`,
    )
    .bind(videoId, now, errorMsg)
    .run()
}

/**
 * CAS variant of recordAttempt.
 * M2 fix: uses WHERE id = ? AND status = 'queued' to prevent double-counting
 * when webhook + cron both try to record the same failed attempt concurrently.
 *
 * Returns the new attempt_count if the update succeeded, or null if it lost the
 * CAS race (another caller already transitioned the row out of 'queued' state).
 */
export async function recordAttemptCAS(
  videoId: string,
  errorMsg: string,
): Promise<number | null> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  const result = await db
    .prepare(
      `UPDATE videos
       SET attempt_count = attempt_count + 1,
           last_attempt_at = ?2,
           last_error = ?3
       WHERE id = ?1 AND status = 'queued'
       RETURNING attempt_count`,
    )
    .bind(videoId, now, errorMsg)
    .first<{ attempt_count: number }>()

  return result?.attempt_count ?? null
}

/**
 * Mark video as permanently failed after MAX_ATTEMPTS exhausted.
 * Status='failed_permanent' — will not be retried.
 *
 * Non-CAS variant. Safe for single-caller paths (e.g. video-status-sync timeout).
 */
export async function markPermanentFailure(videoId: string, reason: string): Promise<void> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  await db
    .prepare(
      `UPDATE videos
       SET status = 'failed_permanent',
           last_attempt_at = ?2,
           last_error = ?3
       WHERE id = ?1`,
    )
    .bind(videoId, now, reason)
    .run()
}

/**
 * CAS variant of markPermanentFailure.
 * M2 fix: uses WHERE id = ? AND status = 'queued' AND attempt_count >= ?
 * to prevent double permanent-failure emails when webhook + cron race.
 *
 * Returns true if this caller "won" the CAS (row was updated), false if another
 * caller already transitioned the row (no-op; caller must skip email + compensation).
 */
export async function markPermanentFailureCAS(
  videoId: string,
  reason: string,
  minAttemptCount: number,
): Promise<boolean> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  const result = await db
    .prepare(
      `UPDATE videos
       SET status = 'failed_permanent',
           last_attempt_at = ?2,
           last_error = ?3
       WHERE id = ?1
         AND status = 'queued'
         AND attempt_count >= ?4
       RETURNING id`,
    )
    .bind(videoId, now, reason, minAttemptCount)
    .first<{ id: string }>()

  return result !== null
}

/**
 * Revoke access for all videos linked to a refunded purchase.
 * Sets access_revoked=1 on every videos row WHERE purchase_id matches.
 * Called atomically with markRefunded in the refund IPN handler.
 */
export async function revokeAccessByPurchaseId(purchaseId: string): Promise<void> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  await db
    .prepare(
      `UPDATE videos
       SET access_revoked = 1,
           updated_at = ?2
       WHERE purchase_id = ?1`,
    )
    .bind(purchaseId, now)
    .run()
}

// ── Read operations ─────────────────────────────────────────────────────────────

/**
 * Find a video row by HeyGen job ID.
 * Used by webhook handler to look up the corresponding videos row.
 */
export async function findByHeygenJobId(heygenJobId: string): Promise<VideoRow | null> {
  try {
    const db = await getD1Raw()
    const row = await db
      .prepare(
        `SELECT id, user_id, purchase_id, heygen_job_id, title, status,
                script, locale, provider, attempt_count, last_attempt_at,
                last_error, created_at
         FROM videos
         WHERE heygen_job_id = ?1
         LIMIT 1`,
      )
      .bind(heygenJobId)
      .first<VideoRow>()

    return row ?? null
  } catch (err) {
    logger.warn('[VideosRepo] findByHeygenJobId failed', { heygenJobId, error: getErrorMessage(err) })
    return null
  }
}

/**
 * Find a video row by purchase_id.
 * Used for idempotency check before enqueueVideo.
 */
export async function findByPurchaseId(purchaseId: string): Promise<VideoRow | null> {
  try {
    const db = await getD1Raw()
    const row = await db
      .prepare(
        `SELECT id, user_id, purchase_id, heygen_job_id, title, status,
                script, locale, provider, attempt_count, last_attempt_at,
                last_error, created_at
         FROM videos
         WHERE purchase_id = ?1
         LIMIT 1`,
      )
      .bind(purchaseId)
      .first<VideoRow>()

    return row ?? null
  } catch (err) {
    logger.warn('[VideosRepo] findByPurchaseId failed', { purchaseId, error: getErrorMessage(err) })
    return null
  }
}

/**
 * Fetch queued rows eligible for retry.
 * Caller applies backoff window filter after fetching.
 */
export async function listQueuedForRetry(maxAttempts: number, limit: number): Promise<VideoRow[]> {
  try {
    const db = await getD1Raw()
    const result = await db
      .prepare(
        `SELECT id, user_id, purchase_id, title, script, locale, provider,
                attempt_count, last_attempt_at, last_error, status, created_at,
                heygen_job_id
         FROM videos
         WHERE status = 'queued' AND attempt_count < ?1
         ORDER BY last_attempt_at ASC NULLS FIRST
         LIMIT ?2`,
      )
      .bind(maxAttempts, limit)
      .all<VideoRow>()

    return result.results ?? []
  } catch (err) {
    logger.error('[VideosRepo] listQueuedForRetry failed', err instanceof Error ? err : undefined)
    return []
  }
}
