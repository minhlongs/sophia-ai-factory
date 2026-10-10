/**
 * Deduplication & Conflicting Memory Arbitration
 *
 * Layer: tree/memory/consolidator
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { MemoryRepository } from '../memory-repository';
import { DEDUPE_SIMILARITY_THRESHOLD, MAX_RELEVANCE } from './types';
import { computeSimilarity } from './semantic-merger';

/** Update content text and relevance of a memory entry. */
export async function updateMemoryContent(
  memoryId: string,
  newText: string,
  newRelevance: number,
): Promise<void> {
  const { getD1 } = await import('@/seed/db/client');
  const d1Db = await getD1();
  if (!d1Db) return;

  const contentJson = JSON.stringify({ text: newText });
  const now = Date.now();

  await d1Db
    .prepare(
      `UPDATE creator_memory
       SET content_json = ?1,
           relevance_score = ?2,
           updated_at = ?3
       WHERE id = ?4`,
    )
    .bind(contentJson, newRelevance, now, memoryId)
    .run();
}

/** Delete a memory by ID. */
export async function deleteMemory(memoryId: string): Promise<void> {
  const { getD1 } = await import('@/seed/db/client');
  const d1Db = await getD1();
  if (!d1Db) return;

  await d1Db
    .prepare(`DELETE FROM creator_memory WHERE id = ?1`)
    .bind(memoryId)
    .run();
}

/**
 * Find and merge near-duplicate memories for a user.
 */
export async function deduplicateMemories(
  repo: MemoryRepository,
  userId: string,
): Promise<number> {
  try {
    const memories = await repo.query(userId, { limit: 500 });
    if (memories.length < 2) return 0;

    const seen = new Set<string>();
    let merged = 0;

    const sorted = [...memories].sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );

    for (let i = 0; i < sorted.length; i++) {
      if (seen.has(sorted[i].id)) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        if (seen.has(sorted[j].id)) continue;

        const similarity = computeSimilarity(
          sorted[i].content.text,
          sorted[j].content.text,
        );

        if (similarity >= DEDUPE_SIMILARITY_THRESHOLD) {
          const mergedContent = `${sorted[i].content.text}\n\n${sorted[j].content.text}`;
          const boostedScore = Math.min(
            MAX_RELEVANCE,
            sorted[i].relevanceScore + 0.15,
          );

          await updateMemoryContent(sorted[i].id, mergedContent, boostedScore);
          await deleteMemory(sorted[j].id);

          seen.add(sorted[j].id);
          merged++;

          logger.debug('[MemoryConsolidator] Merged duplicate', {
            kept: sorted[i].id,
            removed: sorted[j].id,
            similarity,
          });
        }
      }
    }

    if (merged > 0) {
      logger.info('[MemoryConsolidator] Deduplication complete', {
        userId,
        merged,
      });
    }
    return merged;
  } catch (err) {
    logger.error('[MemoryConsolidator] deduplicate failed', {
      userId,
      error: getErrorMessage(err),
    });
    return 0;
  }
}
