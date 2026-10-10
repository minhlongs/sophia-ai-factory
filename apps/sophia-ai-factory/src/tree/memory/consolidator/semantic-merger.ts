/**
 * Semantic Similarity, Decay & Recency Reinforcement
 *
 * Layer: tree/memory/consolidator
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { MemoryRepository } from '../memory-repository';
import {
  DECAY_PERIOD_DAYS,
  DECAY_FACTOR,
  BOOST_FACTOR,
  MAX_RELEVANCE,
} from './types';

/**
 * Compute normalised Levenshtein similarity between two strings.
 *
 * Returns a value in [0.0, 1.0] where 1.0 means identical.
 * Uses the iterative DP approach with O(min(m,n)) space.
 */
export function computeSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0 && lenB === 0) return 1.0;
  if (lenA === 0 || lenB === 0) return 0.0;

  const shorter = lenA < lenB ? a : b;
  const longer = lenA < lenB ? b : a;
  const slen = shorter.length;
  const llen = longer.length;

  if (slen === 0) return 0.0;

  const prev = new Array<number>(slen + 1);
  const curr = new Array<number>(slen + 1);

  for (let i = 0; i <= slen; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= llen; j++) {
    curr[0] = j;
    const lchar = longer.charCodeAt(j - 1);
    for (let i = 1; i <= slen; i++) {
      const cost = shorter.charCodeAt(i - 1) === lchar ? 0 : 1;
      curr[i] = Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost);
    }
    for (let k = 0; k <= slen; k++) {
      prev[k] = curr[k];
    }
  }

  const distance = prev[slen];
  return 1.0 - distance / Math.max(lenA, lenB);
}

/**
 * Halve relevance_score of memories not updated within DECAY_PERIOD_DAYS.
 */
export async function applyMemoryDecay(userId: string): Promise<number> {
  try {
    const { getD1 } = await import('@/seed/db/client');
    const d1Db = await getD1();
    if (!d1Db) throw new Error('D1 database binding not available');

    const cutoff = Date.now() - DECAY_PERIOD_DAYS * 24 * 60 * 60 * 1000;

    const result = await d1Db
      .prepare(
        `UPDATE creator_memory
         SET relevance_score = relevance_score * ?1,
             updated_at = ?2
         WHERE user_id = ?3
           AND updated_at < ?4
           AND expires_at IS NULL`,
      )
      .bind(DECAY_FACTOR, Date.now(), userId, cutoff)
      .run();

    const decayed = result.meta?.changes ?? 0;
    logger.info('[MemoryConsolidator] Decayed memories', {
      userId,
      decayed,
      cutoff: new Date(cutoff).toISOString(),
    });
    return decayed;
  } catch (err) {
    logger.error('[MemoryConsolidator] decayOldMemories failed', {
      userId,
      error: getErrorMessage(err),
    });
    return 0;
  }
}

/**
 * Boost memories that were accessed recently (proxy for frequency).
 */
export async function boostRecentMemories(
  repo: MemoryRepository,
  userId: string,
): Promise<number> {
  try {
    const recent = await repo.query(userId, {
      limit: 20,
      minRelevance: 0.3,
    });

    let boosted = 0;
    const { getD1 } = await import('@/seed/db/client');
    const d1Db = await getD1();
    if (!d1Db) return 0;

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const memory of recent) {
      if (memory.updatedAt >= weekAgo) {
        const newScore = Math.min(MAX_RELEVANCE, memory.relevanceScore + BOOST_FACTOR);
        await d1Db
          .prepare(
            `UPDATE creator_memory
             SET relevance_score = ?1,
                 updated_at = ?2
             WHERE id = ?3`,
          )
          .bind(newScore, now, memory.id)
          .run();
        boosted++;
      }
    }

    return boosted;
  } catch (err) {
    logger.error('[MemoryConsolidator] boostRecentMemories failed', {
      userId,
      error: getErrorMessage(err),
    });
    return 0;
  }
}
