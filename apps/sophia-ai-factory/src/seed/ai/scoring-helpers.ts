/**
 * Scoring helper functions: tokenization, synonym expansion, keyword overlap.
 *
 * @module seed/ai/scoring-helpers
 */

import { SYNONYM_CLUSTERS } from './provider-scoring-types';

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Regex matching lowercase alphanumeric tokens with common punctuation. */
const TOKEN_RE = /[a-z0-9]+(?:[a-z0-9+._]*)/g;

/**
 * Tokenise a string into lowercase tokens.
 */
export function tokenizeText(value: string): string[] {
  return value.toLowerCase().match(TOKEN_RE) ?? [];
}

/**
 * Expand a word set with synonyms from known clusters.
 *
 * If any word in the input set belongs to a cluster, the entire cluster
 * is added. This enables semantic matching (e.g. "cinematic" matches "film").
 */
export function expandSynonyms(words: Set<string>): Set<string> {
  const expanded = new Set(words);
  for (const cluster of SYNONYM_CLUSTERS) {
    if ([...expanded].some((w) => cluster.has(w))) {
      cluster.forEach((syn) => expanded.add(syn));
    }
  }
  return expanded;
}

/**
 * Overlap coefficient between two keyword sets.
 *
 * Uses |A intersect B| / min(|A|, |B|) rather than Jaccard.
 * Jaccard over-penalises tools whose best_for describes many strengths —
 * a premium provider with seven rich bullets gets a smaller Jaccard than
 * a narrowly-scoped provider with one bullet, even when the premium provider
 * fully covers the intent. Overlap coefficient answers the relevant question:
 * "is the intent a subset of what this tool advertises?"
 */
export function keywordOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  const lowerA = new Set([...setA].map((s) => s.toLowerCase().trim()));
  const lowerB = new Set([...setB].map((s) => s.toLowerCase().trim()));
  const intersection = [...lowerA].filter((x) => lowerB.has(x)).length;
  const smaller = Math.min(lowerA.size, lowerB.size);
  return smaller > 0 ? intersection / smaller : 0;
}
