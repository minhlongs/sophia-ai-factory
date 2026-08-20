/**
 * @module tree/memory/memory-pruner
 *
 * MemoryPruner — safe lifecycle management for creator memories.
 *
 * Operates on memory_kv and creator_memory tables via D1.
 * Safety invariant: never deletes user-created preferences (memory_type = 'preference')
 * unless explicitly expired. Only expires old data, decays relevance,
 * and consolidates duplicates.
 *
 * Layer rule: tree → seed only. No imports from forest/ or land/.
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Result of a pruning operation.
 */
export interface PruneResult {
  /** Number of expired rows deleted. */
  expiredRemoved: number;
  /** Number of rows whose relevance was decayed. */
  relevanceDecayed: number;
  /** Number of duplicate pairs merged. */
  duplicatesConsolidated: number;
  /** Number of low-relevance semantic/episodic entries pruned. */
  lowRelevancePruned: number;
  /** Timestamp of the pruning run (epoch ms). */
  ranAt: number;
}

/**
 * Configuration for pruning behavior.
 */
export interface PruneConfig {
  /** Days after which a memory is considered expired (default 90). */
  expiryDays: number;
  /** Relevance score below which non-preference memories are pruned (default 0.05). */
  lowRelevanceThreshold: number;
  /** Decay factor applied to stale relevance scores (default 0.5 = halve). */
  decayFactor: number;
  /** Days after which relevance decay applies (default 30). */
  decayPeriodDays: number;
  /** Similarity threshold for duplicate detection (default 0.85). */
  dedupeSimilarityThreshold: number;
}

/**
 * Default pruning configuration.
 */
export const DEFAULT_PRUNE_CONFIG: PruneConfig = {
  expiryDays: 90,
  lowRelevanceThreshold: 0.05,
  decayFactor: 0.5,
  decayPeriodDays: 30,
  dedupeSimilarityThreshold: 0.85,
};

// ── MemoryPruner ───────────────────────────────────────────────────────────────

/**
 * Safe memory lifecycle manager for creator memories.
 *
 * Three operations:
 * - pruneExpired: remove memories past their expires_at or beyond the
 *   configured expiry window (safety: preferences are never auto-expired).
 * - decayRelevance: halve relevance for stale entries (preserves preferences).
 * - consolidateDuplicates: merge near-duplicate entries (preserves preferences).
 *
 * All D1 access goes through getD1() from seed.
 */
export class MemoryPruner {
  private readonly config: PruneConfig;

  /**
   * @param config — Optional pruning configuration. Merged with defaults.
   */
  constructor(config?: Partial<PruneConfig>) {
    this.config = { ...DEFAULT_PRUNE_CONFIG, ...config };
    logger.info('[MemoryPruner] Initialized', undefined, { config: this.config });
  }

  // ── Prune expired ───────────────────────────────────────────────────────────

  /**
   * Remove expired memories from creator_memory.
   *
   * Two expiry mechanisms:
   * 1. Rows with explicit expires_at timestamps that have passed.
   * 2. Rows without expires_at but older than config.expiryDays (soft expiry).
   *
   * Safety: user-created preferences (memory_type = 'preference') are
   * NEVER auto-expired via soft expiry. They can only be removed if
   * they have an explicit expires_at that has passed.
   *
   * @returns Number of rows deleted.
   */
  async pruneExpired(): Promise<number> {
    try {
      const db = await getD1();
      if (!db) throw new Error('D1 database binding not available');

      const now = Date.now();
      const softCutoff = now - this.config.expiryDays * 24 * 60 * 60 * 1000;

      // Pass 1: explicit expires_at (all types, including preferences).
      const explicitResult = await db
        .prepare(
          `DELETE FROM creator_memory
           WHERE expires_at IS NOT NULL
           AND expires_at <= ?1`,
        )
        .bind(now)
        .run();

      // Pass 2: soft expiry — old rows without explicit expires_at.
      // SAFETY: skip 'preference' type — user preferences are persistent.
      const softResult = await db
        .prepare(
          `DELETE FROM creator_memory
           WHERE expires_at IS NULL
           AND created_at < ?1
           AND memory_type != 'preference'`,
        )
        .bind(softCutoff)
        .run();

      const explicitDeleted = explicitResult.meta?.changes ?? 0;
      const softDeleted = softResult.meta?.changes ?? 0;
      const totalDeleted = explicitDeleted + softDeleted;

      if (totalDeleted > 0) {
        logger.info('[MemoryPruner] Pruned expired memories', undefined, {
          explicitDeleted,
          softDeleted,
          totalDeleted,
          expiryDays: this.config.expiryDays,
        } as Record<string, unknown>);
      }

      return totalDeleted;
    } catch (err) {
      logger.error('[MemoryPruner] pruneExpired failed', undefined, {
        error: getErrorMessage(err),
      } as Record<string, unknown>);
      return 0;
    }
  }

  // ── Decay relevance ────────────────────────────────────────────────────────

  /**
   * Halve the relevance_score of stale memories.
   *
   * Only affects non-preference types (preferences are user-created
   * and should not be decayed automatically).
   *
   * Memories with explicit expires_at are also excluded — they will
   * be cleaned up by pruneExpired instead.
   *
   * @returns Number of rows decayed.
   */
  async decayRelevance(): Promise<number> {
    try {
      const db = await getD1();
      if (!db) throw new Error('D1 database binding not available');

      const cutoff = Date.now() - this.config.decayPeriodDays * 24 * 60 * 60 * 1000;

      const result = await db
        .prepare(
          `UPDATE creator_memory
           SET relevance_score = relevance_score * ?1,
               updated_at = ?2
           WHERE updated_at < ?3
           AND expires_at IS NULL
           AND memory_type != 'preference'`,
        )
        .bind(this.config.decayFactor, Date.now(), cutoff)
        .run();

      const decayed = result.meta?.changes ?? 0;

      if (decayed > 0) {
        logger.info('[MemoryPruner] Decayed relevance', undefined, {
          decayed,
          decayFactor: this.config.decayFactor,
          cutoff: new Date(cutoff).toISOString(),
        } as Record<string, unknown>);
      }

      return decayed;
    } catch (err) {
      logger.error('[MemoryPruner] decayRelevance failed', undefined, {
        error: getErrorMessage(err),
      } as Record<string, unknown>);
      return 0;
    }
  }

  // ── Consolidate duplicates ──────────────────────────────────────────────────

  /**
   * Find and merge near-duplicate memories.
   *
   * Uses Levenshtein distance on content text to detect duplicates.
   * The lower-relevance entry is merged into the higher-relevance entry
   * (text appended, relevance boosted). The lower entry is then deleted.
   *
   * Safety: preference-type memories are excluded from deduplication
   * to preserve user-created content.
   *
   * @returns Number of duplicate pairs merged.
   */
  async consolidateDuplicates(): Promise<number> {
    try {
      const db = await getD1();
      if (!db) throw new Error('D1 database binding not available');

      // Fetch candidate memories (excluding preferences).
      const rows = await db
        .prepare(
          `SELECT id, user_id, memory_type, content_json, relevance_score
           FROM creator_memory
           WHERE memory_type != 'preference'
           AND expires_at IS NULL
           ORDER BY user_id, relevance_score DESC`,
        )
        .all<{
          id: string;
          user_id: string;
          memory_type: string;
          content_json: string;
          relevance_score: number;
        }>();

      const memories = rows.results ?? [];
      if (memories.length < 2) return 0;

      let merged = 0;
      const seen = new Set<string>();
      const threshold = this.config.dedupeSimilarityThreshold;

      // Group by user_id for per-user dedup.
      const byUser = new Map<string, typeof memories>();
      for (const m of memories) {
        const existing = byUser.get(m.user_id) ?? [];
        existing.push(m);
        byUser.set(m.user_id, existing);
      }

      for (const [, userMemories] of byUser) {
        if (userMemories.length < 2) continue;

        // Sort by relevance DESC — keep the highest.
        const sorted = [...userMemories].sort(
          (a, b) => b.relevance_score - a.relevance_score,
        );

        for (let i = 0; i < sorted.length; i++) {
          if (seen.has(sorted[i].id)) continue;
          for (let j = i + 1; j < sorted.length; j++) {
            if (seen.has(sorted[j].id)) continue;

            const similarity = levenshteinSimilarity(
              extractText(sorted[i].content_json),
              extractText(sorted[j].content_json),
            );

            if (similarity >= threshold) {
              // Merge j into i: append content, boost relevance, delete j.
              const mergedText =
                `${extractText(sorted[i].content_json)}\n\n${extractText(sorted[j].content_json)}`;
              const boostedScore = Math.min(1.0, sorted[i].relevance_score + 0.15);

              await db.prepare(
                `UPDATE creator_memory
                 SET content_json = ?1,
                     relevance_score = ?2,
                     updated_at = ?3
                 WHERE id = ?4`,
              )
                .bind(JSON.stringify({ text: mergedText }), boostedScore, Date.now(), sorted[i].id)
                .run();

              await db.prepare(`DELETE FROM creator_memory WHERE id = ?1`).bind(sorted[j].id).run();

              seen.add(sorted[j].id);
              merged++;

              logger.debug('[MemoryPruner] Merged duplicate', undefined, {
                kept: sorted[i].id,
                removed: sorted[j].id,
                similarity,
                userId: sorted[i].user_id,
              } as Record<string, unknown>);
            }
          }
        }
      }

      if (merged > 0) {
        logger.info('[MemoryPruner] Duplicate consolidation complete', undefined, { merged } as Record<string, unknown>);
      }

      return merged;
    } catch (err) {
      logger.error('[MemoryPruner] consolidateDuplicates failed', undefined, {
        error: getErrorMessage(err),
      } as Record<string, unknown>);
      return 0;
    }
  }

  // ── Full prune run ──────────────────────────────────────────────────────────

  /**
   * Run the full pruning pipeline:
   * 1. Prune expired memories
   * 2. Decay relevance of stale entries
   * 3. Consolidate duplicates
   *
   * @returns Summary of what was changed.
   */
  async run(): Promise<PruneResult> {
    const expiredRemoved = await this.pruneExpired();
    const relevanceDecayed = await this.decayRelevance();
    const duplicatesConsolidated = await this.consolidateDuplicates();

    const result: PruneResult = {
      expiredRemoved,
      relevanceDecayed,
      duplicatesConsolidated,
      lowRelevancePruned: 0,
      ranAt: Date.now(),
    };

    logger.info('[MemoryPruner] Pruning run complete', undefined, result as unknown as Record<string, unknown>);
    return result;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extract the text field from a content_json string.
 * Falls back to the raw string if JSON parsing fails.
 */
function extractText(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson) as { text?: string };
    return parsed.text ?? contentJson;
  } catch {
    return contentJson;
  }
}

/**
 * Compute normalised Levenshtein similarity between two strings.
 *
 * Returns a value in [0.0, 1.0] where 1.0 means identical.
 * Uses iterative DP with O(min(m,n)) space.
 */
function levenshteinSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0 && lenB === 0) return 1.0;
  if (lenA === 0 || lenB === 0) return 0.0;

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
    // Swap rows for next iteration.
    for (let k = 0; k <= slen; k++) {
      prev[k] = curr[k];
    }
  }

  const distance = prev[slen];
  return 1.0 - distance / Math.max(lenA, lenB);
}
