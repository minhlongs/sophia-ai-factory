import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  type D1,
  type PruneResult,
  type PruneConfig,
  type MemoryCandidate,
  DEFAULT_PRUNE_CONFIG,
} from './types';
import { decayRelevanceScores } from './decay-evaluator';
import { pruneExpiredMemories } from './tombstone-cleaner';
import {
  extractText,
  levenshteinSimilarity,
  mergeDuplicatePair,
} from './similarity-deduper';

async function deduplicateUserCandidates(
  db: D1,
  candidates: MemoryCandidate[],
  seen: Set<string>,
  threshold: number,
): Promise<number> {
  let merged = 0;
  const sorted = [...candidates].sort((a, b) => b.relevance_score - a.relevance_score);

  for (let i = 0; i < sorted.length; i++) {
    if (seen.has(sorted[i].id)) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      if (seen.has(sorted[j].id)) continue;

      const similarity = levenshteinSimilarity(
        extractText(sorted[i].content_json),
        extractText(sorted[j].content_json),
      );

      if (similarity < threshold) continue;

      await mergeDuplicatePair(db, sorted[i], sorted[j], similarity);
      seen.add(sorted[j].id);
      merged++;
    }
  }
  return merged;
}

export class MemoryPruner {
  private readonly config: PruneConfig;

  constructor(config?: Partial<PruneConfig>) {
    this.config = { ...DEFAULT_PRUNE_CONFIG, ...config };
    logger.info('[MemoryPruner] Initialized', undefined, { config: this.config });
  }

  async pruneExpired(): Promise<number> {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    return pruneExpiredMemories(db, this.config);
  }

  async decayRelevance(): Promise<number> {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    return decayRelevanceScores(db, this.config);
  }

  async consolidateDuplicates(): Promise<number> {
    try {
      const db = await getD1();
      if (!db) throw new Error('D1 database binding not available');

      const rows = await db
        .prepare(
          `SELECT id, user_id, memory_type, content_json, relevance_score
           FROM creator_memory
           WHERE memory_type != 'preference'
           AND expires_at IS NULL
           ORDER BY user_id, relevance_score DESC`,
        )
        .all<MemoryCandidate>();

      const memories = rows.results ?? [];
      if (memories.length < 2) return 0;

      let merged = 0;
      const seen = new Set<string>();
      const threshold = this.config.dedupeSimilarityThreshold;

      const byUser = new Map<string, MemoryCandidate[]>();
      for (const m of memories) {
        const existing = byUser.get(m.user_id) ?? [];
        existing.push(m);
        byUser.set(m.user_id, existing);
      }

      for (const [, userMemories] of byUser) {
        if (userMemories.length < 2) continue;
        merged += await deduplicateUserCandidates(db, userMemories, seen, threshold);
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
