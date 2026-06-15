/**
 * Videos repository — typed CRUD for video fulfillment state machine.
 * Supports queue-first pattern: insert as 'queued' before HeyGen call,
 * then transition to 'processing' on success or record failure for retry.
 *
 * @module lib/db/repositories/videos-repo
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'

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
 *
 * Idempotent: if a row with the same purchase_id already exists (enforced by
 * UNIQUE index from migration 0148), the INSERT is silently skipped and the
 * existing row's id is returned. This eliminates the TOCTOU race in the
 * previous SELECT-then-INSERT pattern.
 */
export async function enqueueVideo(input: EnqueueVideoInput): Promise<string> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)
  const id = crypto.randomUUID()

  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO videos
         (id, user_id, purchase_id, title, script, locale, provider, status,
          attempt_count, is_onboarding, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'queued', 0, 0, ?8)`,
    )
    .bind(id, input.userId, input.purchaseId, input.title, input.script, input.locale, input.provider ?? 'heygen', now)
    .run()

  // If rows_written is 0, UNIQUE constraint on purchase_id blocked the insert —
  // another concurrent request already created the row. Return its id.
  if (result.meta.rows_written === 0 && input.purchaseId) {
    const existing = await findByPurchaseId(input.purchaseId)
    if (existing) {
      logger.info('[VideosRepo] enqueueVideo deduplicated by UNIQUE constraint', {
        purchaseId: input.purchaseId,
        existingId: existing.id,
        attemptedId: id,
      })
      return existing.id
    }
  }

  return id
}

/**
 * Mark video row as `'completed'` immediately, without HeyGen integration.
 * Used by synthetic-monitoring fulfillment (smoke-one-time cron) where the
 * goal is end-to-end chain validation, not actually producing a video.
 *
 * NOT for customer fulfillment — real videos must transition queued → processing
 * → completed via HeyGen webhook (see complete-video-from-webhook.ts).
 */
export async function markVideoCompletedSynthetic(videoId: string): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)

  await db
    .prepare(
      `UPDATE videos
       SET status = 'completed',
           completed_at = ?2,
           last_attempt_at = ?2,
           last_error = NULL,
           video_url = 'synthetic://monitoring/' || ?1
       WHERE id = ?1`,
    )
    .bind(videoId, now)
    .run()
}

/**
 * Transition video row to 'processing' after HeyGen accepted the job.
 * Sets heygen_job_id, increments attempt_count, records last_attempt_at.
 */
export async function markVideoProcessing(videoId: string, heygenJobId: string): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
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
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
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
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
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
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
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
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
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
 * CAS variant of recordAttempt for Webhooks where status = 'processing'.
 * Updates status back to 'queued' to put it back in the retry queue.
 * Returns the new attempt_count if the update succeeded, or null if it lost the CAS race.
 */
export async function recordWebhookAttemptCAS(
  videoId: string,
  errorMsg: string,
): Promise<number | null> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)

  const result = await db
    .prepare(
      `UPDATE videos
       SET status = 'queued',
           attempt_count = attempt_count + 1,
           last_attempt_at = ?2,
           last_error = ?3
       WHERE id = ?1 AND status = 'processing'
       RETURNING attempt_count`,
    )
    .bind(videoId, now, errorMsg)
    .first<{ attempt_count: number }>()

  return result?.attempt_count ?? null
}

/**
 * CAS variant of markPermanentFailure for Webhooks where status = 'processing'.
 * Updates status to 'failed_permanent'.
 * Returns true if this caller won the CAS (row was updated), false if lost.
 */
export async function markWebhookPermanentFailureCAS(
  videoId: string,
  reason: string,
  minAttemptCount: number,
): Promise<boolean> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)

  const result = await db
    .prepare(
      `UPDATE videos
       SET status = 'failed_permanent',
           last_attempt_at = ?2,
           last_error = ?3
       WHERE id = ?1
         AND status = 'processing'
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
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
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

// ── AI-prompt video insert ──────────────────────────────────────────────────────

export interface InsertAiPromptVideoInput {
  /** Better-auth user.id */
  userId: string;
  /** engine_missions.id — used directly as videos.id for deterministic idempotency */
  missionId: string;
  /** R2 object key, e.g. "video-jobs/{missionId}/final.mp4" */
  r2Key: string;
  /** Public R2 URL (https://{R2_PUBLIC_HOSTNAME}/{r2Key}) */
  videoUrl: string;
  /** Optional display title; defaults to "AI Video" */
  title?: string;
}

export interface InsertAiPromptVideoResult {
  /** The videos.id (equals missionId). */
  videoId: string;
  /** True when the row already existed (Inngest retry path). */
  alreadyExisted: boolean;
}

/**
 * Insert a row in `videos` for a FREE100 AI-prompt video.
 *
 * Uses `provider='ai-prompt'`, `heygen_job_id=NULL` (nullable per migration 0089).
 * Idempotent: videos.id = missionId (1:1). INSERT OR IGNORE on PK conflict is a genuine
 * no-op. On Inngest retry, alreadyExisted=true is returned — caller should NOT throw.
 *
 * D1 throws on errors (no .error field on D1Result). Errors propagate to caller.
 */
export async function insertAiPromptVideo(
  input: InsertAiPromptVideoInput,
): Promise<InsertAiPromptVideoResult> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)
  // Use missionId directly as videos.id — deterministic, genuinely idempotent on PK
  const videoId = input.missionId

  try {
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO videos
           (id, user_id, title, status, video_url, r2_key,
            provider, attempt_count, is_onboarding, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'completed', ?4, ?5, 'ai-prompt', 0, 0, ?6, ?6)`,
      )
      .bind(videoId, input.userId, input.title ?? 'AI Video', input.videoUrl, input.r2Key, now)
      .run()

    const alreadyExisted = (result.meta?.changes ?? 1) === 0

    logger.info('[VideosRepo] insertAiPromptVideo', {
      videoId,
      missionId: input.missionId,
      r2Key: input.r2Key,
      alreadyExisted,
    })

    return { videoId, alreadyExisted }
  } catch (dbErr) {
    logger.error('[VideosRepo] insertAiPromptVideo D1 throw', {
      missionId: input.missionId,
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    })
    throw dbErr
  }
}

// ── Read operations ─────────────────────────────────────────────────────────────

/**
 * Find a video row by HeyGen job ID.
 * Used by webhook handler to look up the corresponding videos row.
 */
export async function findByHeygenJobId(
  heygenJobId: string,
  userId?: string | null,
): Promise<VideoRow | null> {
  try {
    const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
    let query = `SELECT id, user_id, purchase_id, heygen_job_id, title, status,
                        script, locale, provider, attempt_count, last_attempt_at,
                        last_error, created_at
                 FROM videos
                 WHERE heygen_job_id = ?1`

    const params: unknown[] = [heygenJobId]
    if (userId) {
      query += ` AND user_id = ?2`
      params.push(userId)
    }
    query += ` LIMIT 1`

    const row = await db
      .prepare(query)
      .bind(...params)
      .first<VideoRow>()

    return row ?? null
  } catch (err) {
    logger.warn('[VideosRepo] findByHeygenJobId failed', {
      heygenJobId,
      userId,
      error: getErrorMessage(err),
    })
    return null
  }
}

/**
 * Find a video row by purchase_id.
 * Used for idempotency check before enqueueVideo.
 */
export async function findByPurchaseId(purchaseId: string): Promise<VideoRow | null> {
  try {
    const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
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
    const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
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
