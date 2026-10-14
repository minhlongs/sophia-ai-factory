/**
 * Failure, revocation, and AI-prompt video write operations for videos repository.
 * @module seed/db/repositories/videos-repo-status-writes
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  InsertAiPromptVideoInput,
  InsertAiPromptVideoResult,
} from './videos-repo-types';

/** Mark video as permanently failed after MAX_ATTEMPTS exhausted (non-CAS). */
export async function markPermanentFailure(videoId: string, reason: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `UPDATE videos
       SET status = 'failed_permanent',
           last_attempt_at = ?2,
           last_error = ?3
       WHERE id = ?1`,
    )
    .bind(videoId, now, reason)
    .run();
}

/** Revoke access for all videos linked to a purchase (e.g. on refund). */
export async function revokeAccessByPurchaseId(purchaseId: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `UPDATE videos
       SET access_revoked = 1,
           last_attempt_at = ?2
       WHERE purchase_id = ?1`,
    )
    .bind(purchaseId, now)
    .run();
}

/**
 * Insert a row for a FREE100 AI-prompt video (provider='ai-prompt').
 * Idempotent on PK (videos.id = missionId). D1 throws on errors.
 */
export async function insertAiPromptVideo(
  input: InsertAiPromptVideoInput,
): Promise<InsertAiPromptVideoResult> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const now = Math.floor(Date.now() / 1000);

  try {
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO videos (id, user_id, provider, heygen_job_id, purchase_id, status, attempt_count, last_attempt_at, access_revoked, last_error, created_at)
         VALUES (?1, ?2, 'ai-prompt', NULL, NULL, 'queued', 0, NULL, 0, NULL, ?3)
         RETURNING id`,
      )
      .bind(input.missionId, input.userId, now)
      .first<{ id: string }>();

    if (result === null) {
      return { videoId: input.missionId, alreadyExisted: true };
    }

    return { videoId: result.id, alreadyExisted: false };
  } catch (dbErr) {
    logger.error('[VideosRepo] insertAiPromptVideo D1 throw', {
      missionId: input.missionId,
      userId: input.userId,
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
    throw dbErr;
  }
}
