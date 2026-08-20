/**
 * CAS (Compare-And-Swap) write operations for the videos repository.
 * Used for concurrent-safe state transitions when webhook + cron may race.
 *
 * @module seed/db/repositories/videos-repo-cas
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

/**
 * CAS variant of recordAttempt.
 * Uses WHERE id = ? AND status = 'queued' to prevent double-counting
 * when webhook + cron both try to record the same failed attempt concurrently.
 *
 * Returns the new attempt_count if the update succeeded, or null if it lost the
 * CAS race (attempt_count already incremented by another caller).
 */
export async function recordAttemptCAS(
  videoId: string,
  errorMsg: string,
): Promise<number | null> {
  const _db = await getD1()
  if (!_db) throw new Error('D1 binding not available')
  const db = _db
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
 * CAS variant of markPermanentFailure.
 * Only marks permanent failure if attempt_count >= minAttemptCount,
 * to prevent double permanent-failure emails when webhook + cron race.
 * Returns true if the CAS succeeded (caller should send failure email),
 * false if another path already marked it.
 */
export async function markPermanentFailureCAS(
  videoId: string,
  reason: string,
  minAttemptCount: number,
): Promise<boolean> {
  const _db = await getD1()
  if (!_db) throw new Error('D1 binding not available')
  const db = _db
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

  if (result?.id) {
    logger.info('[VideosRepo] markPermanentFailureCAS succeeded', { videoId })
    return true
  }

  logger.info('[VideosRepo] markPermanentFailureCAS — no-op (CAS lost or already terminal)', { videoId })
  return false
}

/**
 * Non-CAS markPermanentFailure — for queue-first path where cron owns the row.
 * No WHERE state guard — caller is expected to own the row.
 */
export async function markPermanentFailure(
  videoId: string,
  reason: string,
): Promise<boolean> {
  const _db = await getD1()
  if (!_db) throw new Error('D1 binding not available')
  const db = _db
  const now = Math.floor(Date.now() / 1000)

  const result = await db
    .prepare(
      `UPDATE videos
       SET status = 'failed_permanent',
           last_attempt_at = ?2,
           last_error = ?3
       WHERE id = ?1
       RETURNING id`,
    )
    .bind(videoId, now, reason)
    .first<{ id: string }>()

  return !!result?.id
}

/**
 * CAS variant of recordAttempt for Webhooks where status = 'processing'.
 * Sets status back to 'queued' and increments attempt_count.
 * Returns the new attempt_count if CAS succeeded, or null if lost.
 */
export async function recordWebhookAttemptCAS(
  videoId: string,
  errorMsg: string,
): Promise<number | null> {
  const _db = await getD1()
  if (!_db) throw new Error('D1 binding not available')
  const db = _db
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
 * Returns true if the CAS succeeded (caller should send failure email),
 * false if another path already marked it.
 */
export async function markWebhookPermanentFailureCAS(
  videoId: string,
  reason: string,
  minAttemptCount: number,
): Promise<boolean> {
  const _db = await getD1()
  if (!_db) throw new Error('D1 binding not available')
  const db = _db
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

  if (result?.id) {
    logger.info('[VideosRepo] markWebhookPermanentFailureCAS succeeded', { videoId })
    return true
  }

  logger.info('[VideosRepo] markWebhookPermanentFailureCAS — no-op (CAS lost or already terminal)', { videoId })
  return false
}
