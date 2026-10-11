import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { AddMemoryParams } from './types';

/**
 * Insert a new creator memory entry.
 * Returns the generated memory ID.
 * Throws on D1 constraint violation.
 */
export async function addMemory(params: AddMemoryParams): Promise<string> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO creator_memory
         (id, user_id, memory_type, category, content_json,
          relevance_score, source_execution_id, expires_at,
          created_at, updated_at)
       VALUES
         (?1, ?2, ?3, ?4, ?5,
          ?6, ?7, ?8,
          ?9, ?9)`,
    )
    .bind(
      id,
      params.userId,
      params.memoryType,
      params.category,
      params.contentJson,
      params.relevanceScore ?? 1.0,
      params.sourceExecutionId ?? null,
      params.expiresAt ?? null,
      now,
    )
    .run();

  logger.info('[CreatorMemoryRepo] Memory added', {
    id,
    userId: params.userId,
    memoryType: params.memoryType,
    category: params.category,
  });

  return id;
}

/**
 * Update the relevance score of a memory entry (decay or boost).
 * Clamps the score to [0.0, 1.0] to prevent runaway values.
 * Throws on D1 error.
 */
export async function updateMemoryRelevance(
  id: string,
  relevanceScore: number,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const clamped = Math.max(0.0, Math.min(1.0, relevanceScore));
  const now = Date.now();

  await db
    .prepare(
      `UPDATE creator_memory
       SET relevance_score = ?2,
           updated_at = ?3
       WHERE id = ?1`,
    )
    .bind(id, clamped, now)
    .run();

  logger.info('[CreatorMemoryRepo] Relevance updated', { id, relevanceScore: clamped });
}

/**
 * Delete all memory entries whose expires_at has passed.
 * Returns the number of rows deleted (D1 meta.changes).
 * Returns 0 on error.
 */
export async function pruneExpiredMemories(): Promise<number> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const now = Date.now();

    const result = await db
      .prepare(
        `DELETE FROM creator_memory
         WHERE expires_at IS NOT NULL AND expires_at <= ?1`,
      )
      .bind(now)
      .run();

    const deleted = result.meta?.changes ?? 0;
    logger.info('[CreatorMemoryRepo] Pruned expired memories', { deleted });
    return deleted;
  } catch (err) {
    logger.error('[CreatorMemoryRepo] pruneExpiredMemories failed', {
      error: getErrorMessage(err),
    });
    return 0;
  }
}
