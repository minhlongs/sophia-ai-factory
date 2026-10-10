/**
 * Types & Constants for Memory Consolidation
 *
 * Layer: tree/memory/consolidator
 */

/** Days after which a memory is considered stale and subject to decay. */
export const DECAY_PERIOD_DAYS = 30;
/** Multiplier applied during decay (halve the relevance score). */
export const DECAY_FACTOR = 0.5;
/** Minimum similarity ratio (0.0–1.0) to consider two memories duplicates. */
export const DEDUPE_SIMILARITY_THRESHOLD = 0.85;
/** Boost factor applied per access event. */
export const BOOST_FACTOR = 0.1;
/** Maximum relevance score after boosting (clamped to 1.0). */
export const MAX_RELEVANCE = 1.0;

/** Summary of a consolidation run. */
export interface ConsolidationResult {
  userId: string;
  decayed: number;
  duplicatesMerged: number;
  boosted: number;
  ranAt: number;
}
