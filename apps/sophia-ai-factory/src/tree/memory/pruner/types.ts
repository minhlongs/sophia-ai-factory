import type { getD1 } from '@/seed/db/client';

export type D1 = NonNullable<Awaited<ReturnType<typeof getD1>>>;

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

export interface MemoryCandidate {
  id: string;
  user_id: string;
  memory_type: string;
  content_json: string;
  relevance_score: number;
}
