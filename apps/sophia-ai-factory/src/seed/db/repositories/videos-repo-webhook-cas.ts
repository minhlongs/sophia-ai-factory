/**
 * Webhook CAS (Compare-And-Swap) write operations for the videos repository.
 * Used when webhook callbacks transition videos from 'processing' state.
 *
 * @module seed/db/repositories/videos-repo-webhook-cas
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

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
