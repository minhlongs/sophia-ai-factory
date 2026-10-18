/**
 * @module seed/ai/provider-scoring-constants
 *
 * Synonym clusters and dimension weights for the 7-dimension provider scoring engine.
 */

// ── Synonym clusters for semantic matching ────────────────────────────────────
// When intent says "cinematic" and a tool says "film", that is a match
// even without literal keyword overlap. Each set is a synonym cluster.

export const SYNONYM_CLUSTERS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(['cinematic', 'film', 'movie', 'trailer', 'dramatic', 'epic']),
  new Set(['explainer', 'educational', 'tutorial', 'teaching', 'lesson']),
  new Set(['social', 'tiktok', 'instagram', 'reels', 'shorts', 'viral']),
  new Set(['animation', 'animated', 'motion-graphics', 'motion', 'kinetic']),
  new Set(['avatar', 'presenter', 'talking-head', 'spokesperson']),
  new Set(['voiceover', 'narration', 'speech', 'voice']),
  new Set(['music', 'soundtrack', 'background-music', 'score', 'ambient']),
] as const;

// ── Dimension weights ─────────────────────────────────────────────────────────
// task_fit * 0.30 + output_quality * 0.20 + control * 0.15 +
// reliability * 0.15 + cost_efficiency * 0.10 + latency * 0.05 +
// continuity * 0.05

export const DIMENSION_WEIGHTS = {
  task_fit: 0.30,
  output_quality: 0.20,
  control: 0.15,
  reliability: 0.15,
  cost_efficiency: 0.10,
  latency: 0.05,
  continuity: 0.05,
} as const;
