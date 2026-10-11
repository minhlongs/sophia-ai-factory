import { getD1, D1NotAvailableError } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { FeedbackInput, FeedbackStored, FeedbackRow } from './types';
import { MAX_FREE_TEXT_LENGTH } from './types';
import { newFeedbackId, buildIdempotencyKey, rowToStored } from './helpers';

/**
 * Persist a feedback row. Idempotent on idempotency_key — re-submitting the
 * same (mission, checkpoint, day) returns the existing row without error.
 *
 * Returns the stored row (new or existing).
 */
export async function saveFeedback(input: FeedbackInput): Promise<FeedbackStored> {
  const db = await getD1();
  if (!db) throw new D1NotAvailableError();

  const now = Date.now();
  const id = newFeedbackId();
  const idempotencyKey = buildIdempotencyKey(input.missionId, input.checkpoint, now);
  const freeText = input.freeText ? input.freeText.slice(0, MAX_FREE_TEXT_LENGTH) : null;

  // Idempotent upsert: ON CONFLICT on the unique idempotency_key returns the
  // existing row. D1 has no transactions; we rely on the UNIQUE constraint.
  const insertSql = `
    INSERT INTO reality_feedback
      (id, workspace_id, mission_id, checkpoint, useful, reason, free_text, idempotency_key, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(idempotency_key) DO UPDATE SET id = id
    RETURNING *;
  `;

  try {
    const result = await db
      .prepare(insertSql)
      .bind(
        id,
        input.workspaceId,
        input.missionId,
        input.checkpoint,
        input.useful,
        input.reason ?? null,
        freeText,
        idempotencyKey,
        now,
      )
      .first<FeedbackRow>();

    if (!result) {
      // ON CONFLICT triggered — fetch the existing row by idempotency_key.
      const existing = await db
        .prepare(`SELECT * FROM reality_feedback WHERE idempotency_key = ?1 LIMIT 1`)
        .bind(idempotencyKey)
        .first<FeedbackRow>();
      if (existing) return rowToStored(existing);
      throw new Error('Feedback upsert returned no row');
    }

    return rowToStored(result);
  } catch (error) {
    // Log metadata only — NEVER echo free_text.
    logger.error(
      '[RealityFeedback] save failed',
      error instanceof Error ? error : new Error(String(error)),
      { workspaceId: input.workspaceId, missionId: input.missionId, checkpoint: input.checkpoint },
    );
    throw error;
  }
}
