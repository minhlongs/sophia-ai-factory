/**
 * Creative Memory Confidence Decay
 * Layer: tree (domain-specific reusable)
 *
 * Pure computation: 30-day half-life exponential decay for memories
 * without reinforcement. No DB column for half-life — computed at read time.
 *
 * @module tree/creative-memory/decay
 */

import type { MemoryConfidence } from '@/seed/types/creative-domain';

const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Confidence → numeric base (0-1) for decay math */
const CONFIDENCE_BASE: Record<MemoryConfidence, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

/** Numeric score back to confidence label */
function scoreToConfidence(score: number): MemoryConfidence {
  if (score >= 0.75) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

/**
 * Compute the decayed confidence score for a memory.
 *
 * @param baseConfidence - original confidence level
 * @param updatedAt - last reinforced timestamp (ms epoch)
 * @param nowMs - current time (ms epoch), defaults to Date.now()
 * @returns confidence level after decay
 */
export function computeDecayedConfidence(
  baseConfidence: MemoryConfidence,
  updatedAt: number,
  nowMs: number = Date.now(),
): MemoryConfidence {
  const base = CONFIDENCE_BASE[baseConfidence];
  const elapsed = Math.max(0, nowMs - updatedAt);
  const decay = Math.pow(0.5, elapsed / HALF_LIFE_MS);
  const score = base * decay;
  return scoreToConfidence(score);
}

/**
 * Compute numeric decay score (0-1) — useful for sorting / filtering.
 */
export function computeDecayScore(
  baseConfidence: MemoryConfidence,
  updatedAt: number,
  nowMs: number = Date.now(),
): number {
  const base = CONFIDENCE_BASE[baseConfidence];
  const elapsed = Math.max(0, nowMs - updatedAt);
  const decay = Math.pow(0.5, elapsed / HALF_LIFE_MS);
  return base * decay;
}

/**
 * Filter a list of memories to those still above a minimum score.
 * Useful for pruning stale memories before strategy generation.
 */
export function filterActiveMemories<T extends { confidence: MemoryConfidence; updatedAt: number }>(
  memories: T[],
  minScore: number = 0.2,
  nowMs: number = Date.now(),
): T[] {
  return memories.filter((m) => computeDecayScore(m.confidence, m.updatedAt, nowMs) >= minScore);
}
