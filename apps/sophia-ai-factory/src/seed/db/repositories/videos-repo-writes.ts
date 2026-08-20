/**
 * Write operations for the videos repository (non-CAS).
 * CAS operations are in videos-repo-cas.ts.
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import type {
  EnqueueVideoInput,
  InsertAiPromptVideoInput,
  InsertAiPromptVideoResult,
} from './videos-repo-types'

/**
 * Insert a new video row with status='queued' (before HeyGen call).
 * If videoId is provided it is used as PK (idempotent insert).
 */
export async function enqueueVideo(
  input: EnqueueVideoInput,
): Promise<string> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;

  const id = input.videoId ?? crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

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
    const existing = await db
      .prepare(`SELECT id FROM videos WHERE purchase_id = ?1`)
      .bind(input.purchaseId)
      .first<{ id: string }>()
    if (existing) {
      logger.warn('[VideosRepo] enqueueVideo deduplicated by UNIQUE constraint', {
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
 * Mark video as 'completed' immediately (synthetic-monitoring / smoke tests).
 * NOT for real customer fulfillment.
 */
export async function markVideoCompletedSynthetic(videoId: string): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)

  await db
    .prepare(
      `UPDATE videos
       SET status = 'completed',
           last_attempt_at = ?2,
           attempt_count = attempt_count + 1,
           last_error = NULL,
           heygen_job_id = NULL
       WHERE id = ?1`,
    )
    .bind(videoId, now)
    .run()
}

/** Transition video from 'queued' to 'processing' (HeyGen job started). */
export async function markVideoProcessing(videoId: string, heygenJobId: string): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)

  await db
    .prepare(
      `UPDATE videos
       SET status = 'processing',
           heygen_job_id = ?2,
           last_attempt_at = ?3,
           last_error = NULL
       WHERE id = ?1`,
    )
    .bind(videoId, heygenJobId, now)
    .run()
}

/** Record a failed attempt (non-CAS). Status stays 'queued' for retry cron pickup. */
export async function recordAttempt(videoId: string, errorMsg: string): Promise<void> {
  const _db = await getD1();
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

/** Mark video as permanently failed after MAX_ATTEMPTS exhausted (non-CAS). */
export async function markPermanentFailure(videoId: string, reason: string): Promise<void> {
  const _db = await getD1();
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

/** Revoke access for all videos linked to a purchase (e.g. on refund). */
export async function revokeAccessByPurchaseId(purchaseId: string): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)

  await db
    .prepare(
      `UPDATE videos
       SET access_revoked = 1,
           last_attempt_at = ?2
       WHERE purchase_id = ?1`,
    )
    .bind(purchaseId, now)
    .run()
}

/**
 * Insert a row for a FREE100 AI-prompt video (provider='ai-prompt').
 * Idempotent on PK (videos.id = missionId). D1 throws on errors.
 */
export async function insertAiPromptVideo(
  input: InsertAiPromptVideoInput,
): Promise<InsertAiPromptVideoResult> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000)

  try {
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO videos (id, user_id, provider, heygen_job_id, purchase_id, status, attempt_count, last_attempt_at, access_revoked, last_error, created_at)
         VALUES (?1, ?2, 'ai-prompt', NULL, NULL, 'queued', 0, NULL, 0, NULL, ?3)
         RETURNING id`,
      )
      .bind(input.missionId, input.userId, now)
      .first<{ id: string }>()

    // D1 returns null for INSERT OR IGNORE when row existed (no-op)
    if (result === null) {
      return { videoId: input.missionId, alreadyExisted: true }
    }

    return { videoId: result.id, alreadyExisted: false }
  } catch (dbErr) {
    logger.error('[VideosRepo] insertAiPromptVideo D1 throw', {
      missionId: input.missionId,
      userId: input.userId,
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    })
    throw dbErr
  }
}
