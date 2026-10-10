/**
 * Memory Lifecycle Consolidator Coordinator
 *
 * Layer: tree/memory/consolidator
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { MemoryRepository } from '../memory-repository';
import {
  BOOST_FACTOR,
  MAX_RELEVANCE,
  type ConsolidationResult,
} from './types';
import { deduplicateMemories } from './conflict-resolver';
import { applyMemoryDecay, boostRecentMemories } from './semantic-merger';

/**
 * Manages the lifecycle of creator memories:
 * decay, deduplication, access-based boosting, and full consolidation.
 */
export class MemoryConsolidator {
  private readonly repo: MemoryRepository;

  constructor() {
    this.repo = new MemoryRepository();
  }

  // ── Decay ──────────────────────────────────────────────────────────────────

  /**
   * Halve the relevance_score of memories that have not been updated
   * within the decay period (default 30 days).
   */
  async decayOldMemories(userId: string): Promise<number> {
    return applyMemoryDecay(userId);
  }

  // ── Boost ──────────────────────────────────────────────────────────────────

  /**
   * Boost the relevance of a specific memory by access frequency.
   */
  async boostMemory(memoryId: string): Promise<number | null> {
    try {
      const { getD1 } = await import('@/seed/db/client');
      const d1Db = await getD1();
      if (!d1Db) throw new Error('D1 database binding not available');

      const row = await d1Db
        .prepare(
          `SELECT relevance_score FROM creator_memory WHERE id = ?1 LIMIT 1`,
        )
        .bind(memoryId)
        .first<{ relevance_score: number }>();

      if (!row) {
        logger.warn('[MemoryConsolidator] boostMemory: memory not found', {
          memoryId,
        });
        return null;
      }

      const newScore = Math.min(MAX_RELEVANCE, row.relevance_score + BOOST_FACTOR);
      const now = Date.now();

      await d1Db
        .prepare(
          `UPDATE creator_memory
           SET relevance_score = ?1,
               updated_at = ?2
           WHERE id = ?3`,
        )
        .bind(newScore, now, memoryId)
        .run();

      logger.debug('[MemoryConsolidator] Boosted memory', {
        memoryId,
        previousScore: row.relevance_score,
        newScore,
      });
      return newScore;
    } catch (err) {
      logger.error('[MemoryConsolidator] boostMemory failed', {
        memoryId,
        error: getErrorMessage(err),
      });
      return null;
    }
  }

  // ── Deduplicate ────────────────────────────────────────────────────

  /**
   * Find and merge near-duplicate memories for a user.
   */
  async deduplicate(userId: string): Promise<number> {
    return deduplicateMemories(this.repo, userId);
  }

  // ── Full Consolidate ───────────────────────────────────────────────

  /**
   * Run the full consolidation pipeline for a user:
   * 1. Decay old memories
   * 2. Deduplicate similar entries
   * 3. Boost frequently accessed memories (those with high updated_at recency)
   */
  async consolidate(userId: string): Promise<ConsolidationResult> {
    const decayed = await this.decayOldMemories(userId);
    const duplicatesMerged = await this.deduplicate(userId);
    const boosted = await boostRecentMemories(this.repo, userId);

    const result: ConsolidationResult = {
      userId,
      decayed,
      duplicatesMerged,
      boosted,
      ranAt: Date.now(),
    };

    logger.info('[MemoryConsolidator] Consolidation complete', {
      userId: result.userId,
      decayed: result.decayed,
      duplicatesMerged: result.duplicatesMerged,
      boosted: result.boosted,
      ranAt: result.ranAt,
    });
    return result;
  }
}
