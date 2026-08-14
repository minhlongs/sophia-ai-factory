/**
 * @module tree/memory/memory-consolidator
 *
 * MemoryConsolidator — lifecycle management for creator memories.
 *
 * Concerns:
 * - decayOldMemories — halve relevance_score every 30 days for stale entries
 * - boostMemory — increase relevance for frequently accessed memories
 * - deduplicate — merge near-duplicate memories (Levenshtein similarity >= 0.85)
 * - consolidate — full pipeline: decay → deduplicate → boost accessed
 *
 * All D1 access goes through MemoryRepository (tree → seed only).
 *
 * @module tree/memory/memory-consolidator
 */

import { MemoryRepository, type StoredMemory } from './memory-repository';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Days after which a memory is considered stale and subject to decay. */
const DECAY_PERIOD_DAYS = 30;
/** Multiplier applied during decay (halve the relevance score). */
const DECAY_FACTOR = 0.5;
/** Minimum similarity ratio (0.0–1.0) to consider two memories duplicates. */
const DEDUPE_SIMILARITY_THRESHOLD = 0.85;
/** Boost factor applied per access event. */
const BOOST_FACTOR = 0.1;
/** Maximum relevance score after boosting (clamped to 1.0). */
const MAX_RELEVANCE = 1.0;

// ── Consolidation result ──────────────────────────────────────────────────────

/** Summary of a consolidation run. */
export interface ConsolidationResult {
  userId: string;
  decayed: number;
  duplicatesMerged: number;
  boosted: number;
  ranAt: number;
}

// ── MemoryConsolidator ────────────────────────────────────────────────────────

/**
 * Manages the lifecycle of creator memories:
 * decay, deduplication, access-based boosting, and full consolidation.
 *
 * One instance per user (or shared with userId passed to each method).
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
   *
   * Only affects memories without an explicit expires_at (NULL = persistent).
   *
   * @param userId — whose memories to decay
   * @returns number of rows decayed
   */
  async decayOldMemories(userId: string): Promise<number> {
    try {
      const _db = this.repo;
      // Access the underlying D1 binding for a bulk update.
      const { getD1 } = await import('@/seed/db/client');
      const d1Db = getD1();
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

  // ── Boost ──────────────────────────────────────────────────────────────────

  /**
   * Boost the relevance of a specific memory by access frequency.
   *
   * Each call increases relevance_score by BOOST_FACTOR (0.1),
   * clamped to MAX_RELEVANCE (1.0). Also bumps updated_at.
   *
   * @param memoryId — UUID of the memory to boost
   * @returns the new relevance score, or null on failure
   */
  async boostMemory(memoryId: string): Promise<number | null> {
    try {
      // Fetch current score first to compute the new value.
      const { getD1 } = await import('@/seed/db/client');
      const d1Db = getD1();
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

  // ── Deduplicate ────────────────────────────────────────────────────────────

  /**
   * Find and merge near-duplicate memories for a user.
   *
   * Uses Levenshtein distance on content.text to compute similarity.
   * Pairs with similarity >= DEDUPE_SIMILARITY_THRESHOLD (0.85) are merged:
   * the lower-relevance entry is deleted, the higher-relevance entry's
   * content is updated to include both texts, and its relevance is boosted.
   *
   * @param userId — whose memories to deduplicate
   * @returns number of duplicate pairs merged
   */
  async deduplicate(userId: string): Promise<number> {
    try {
      const memories = await this.repo.query(userId, { limit: 500 });
      if (memories.length < 2) return 0;

      const seen = new Set<string>();
      let merged = 0;

      // Sort by relevance DESC so we keep the highest-relevance entry.
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
            // Merge j into i: append content, boost relevance, delete j.
            const mergedContent = `${sorted[i].content.text}\n\n${sorted[j].content.text}`;
            const boostedScore = Math.min(
              MAX_RELEVANCE,
              sorted[i].relevanceScore + 0.15,
            );

            await this.updateMemoryContent(sorted[i].id, mergedContent, boostedScore);
            await this.deleteMemory(sorted[j].id);

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

  // ── Full Consolidate ────────────────────────────────────────────────────────

  /**
   * Run the full consolidation pipeline for a user:
   * 1. Decay old memories
   * 2. Deduplicate similar entries
   * 3. Boost frequently accessed memories (those with high updated_at recency)
   *
   * @param userId — whose memories to consolidate
   * @returns summary of what changed
   */
  async consolidate(userId: string): Promise<ConsolidationResult> {
    const decayed = await this.decayOldMemories(userId);
    const duplicatesMerged = await this.deduplicate(userId);
    const boosted = await this.boostRecentMemories(userId);

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

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Boost memories that were accessed recently (proxy for frequency). */
  private async boostRecentMemories(userId: string): Promise<number> {
    try {
      const recent = await this.repo.query(userId, {
        limit: 20,
        minRelevance: 0.3,
      });

      let boosted = 0;
      const { getD1 } = await import('@/seed/db/client');
      const d1Db = getD1();
      if (!d1Db) return 0;

      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

      for (const memory of recent) {
        // Boost if updated within the last week (recently accessed).
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

  /** Update content text and relevance of a memory entry. */
  private async updateMemoryContent(
    memoryId: string,
    newText: string,
    newRelevance: number,
  ): Promise<void> {
    const { getD1 } = await import('@/seed/db/client');
    const d1Db = getD1();
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
  private async deleteMemory(memoryId: string): Promise<void> {
    const { getD1 } = await import('@/seed/db/client');
    const d1Db = getD1();
    if (!d1Db) return;

    await d1Db
      .prepare(`DELETE FROM creator_memory WHERE id = ?1`)
      .bind(memoryId)
      .run();
  }
}

// ── Levenshtein similarity ────────────────────────────────────────────────────

/**
 * Compute normalised Levenshtein similarity between two strings.
 *
 * Returns a value in [0.0, 1.0] where 1.0 means identical.
 * Uses the iterative DP approach with O(min(m,n)) space.
 *
 * @param a — first string
 * @param b — second string
 * @returns similarity ratio 0.0–1.0
 */
export function computeSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0 && lenB === 0) return 1.0;
  if (lenA === 0 || lenB === 0) return 0.0;

  // Use the shorter string as the columns for the DP matrix.
  const shorter = lenA < lenB ? a : b;
  const longer = lenA < lenB ? b : a;
  const slen = shorter.length;
  const llen = longer.length;

  if (slen === 0) return 0.0;

  // Two-row DP: previous and current.
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
    // Swap rows: copy curr into prev, reuse curr buffer.
    for (let k = 0; k <= slen; k++) {
      prev[k] = curr[k];
    }
  }

  const distance = prev[slen];
  return 1.0 - distance / Math.max(lenA, lenB);
}
