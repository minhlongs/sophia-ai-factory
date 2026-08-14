/**
 * Read (query) operations for the videos repository.
 *
 * @module seed/db/repositories/videos-repo-reads
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import type { VideoRow } from './videos-repo-types'

/**
 * Find a video row by HeyGen job ID.
 * Returns null when no row matches.
 */
export async function findByHeygenJobId(
  heygenJobId: string,
  _ownerUserId?: string | null,
): Promise<VideoRow | null> {
  const _db = getD1()
  if (!_db) throw new Error('D1 binding not available')
  const db = _db

  try {
    const result = await db
      .prepare(
        `SELECT id, user_id, purchase_id, title, provider,
                heygen_job_id, status, script, locale, attempt_count,
                last_attempt_at,
                last_error, created_at
         FROM videos
         WHERE heygen_job_id = ?1`,
      )
      .bind(heygenJobId)
      .first<VideoRow>()

    return result ?? null
  } catch (err) {
    logger.warn('[VideosRepo] findByHeygenJobId failed', {
      heygenJobId,
      error: getErrorMessage(err),
    })
    return null
  }
}

/**
 * Find a video row by purchase ID.
 * Returns null when no row matches.
 */
export async function findByPurchaseId(purchaseId: string): Promise<VideoRow | null> {
  const _db = getD1()
  if (!_db) throw new Error('D1 binding not available')
  const db = _db

  try {
    const result = await db
      .prepare(
        `SELECT id, user_id, purchase_id, title, provider,
                heygen_job_id, status, script, locale, attempt_count,
                last_attempt_at,
                last_error, created_at
         FROM videos
         WHERE purchase_id = ?1`,
      )
      .bind(purchaseId)
      .first<VideoRow>()

    return result ?? null
  } catch (err) {
    logger.warn('[VideosRepo] findByPurchaseId failed', { purchaseId, error: getErrorMessage(err) })
    return null
  }
}

/**
 * List videos that are queued and haven't exceeded max attempts.
 * Ordered by last_attempt_at ASC (oldest first — FIFO retry).
 */
export async function listQueuedForRetry(
  maxAttempts: number,
  limit = 10,
): Promise<VideoRow[]> {
  const _db = getD1()
  if (!_db) throw new Error('D1 binding not available')
  const db = _db

  try {
    const result = await db
      .prepare(
        `SELECT id, user_id, purchase_id, title, provider,
                heygen_job_id, status, script, locale,
                attempt_count, last_attempt_at,
                last_error, created_at
         FROM videos
         WHERE status = 'queued' AND attempt_count < ?1
         ORDER BY last_attempt_at ASC NULLS FIRST
         LIMIT ?2`,
      )
      .bind(maxAttempts, limit)
      .all<VideoRow>()

    return result.results ?? []
  } catch {
    return []
  }
}
