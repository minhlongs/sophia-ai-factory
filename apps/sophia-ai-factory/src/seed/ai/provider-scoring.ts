/**
 * 7-dimension provider scoring engine — barrel re-export.
 *
 * Scores AI providers against a task context using weighted multi-dimensional
 * evaluation: task_fit, output_quality, control, reliability, cost_efficiency,
 * latency, and continuity. Uses synonym expansion for semantic matching and
 * overlap coefficient (not Jaccard) for keyword overlap.
 *
 * Cloudflare Workers compatible — no Node.js APIs.
 *
 * Layer rule: seed only — imports from seed/ utilities exclusively.
 *
 * @module seed/ai/provider-scoring
 */

export { createLogger } from '@/seed/utils/logger-utility';

export {
  SYNONYM_CLUSTERS,
  DIMENSION_WEIGHTS,
  type ProviderScore,
  type TaskContext,
  type ToolInfo,
} from './provider-scoring-types';

export { keywordOverlap } from './scoring-helpers';

export { scoreProvider } from './score-provider';

// ── Public API ────────────────────────────────────────────────────────────────

import { scoreProvider } from './score-provider';
import type { ProviderScore, TaskContext, ToolInfo } from './provider-scoring-types';

/**
 * Rank a list of tools by weighted score for a given task context.
 *
 * Returns scores sorted best-first (highest weighted_score first).
 * @param tools - Array of provider metadata implementing ToolInfo.
 * @param taskContext - Task description and constraints.
 * @returns ProviderScore[] sorted by weighted_score descending.
 */
export function rankProviders(
  tools: readonly ToolInfo[],
  taskContext: TaskContext,
): ProviderScore[] {
  const scores = tools.map((tool) => scoreProvider(tool, taskContext));
  return scores.sort((a, b) => b.weighted_score - a.weighted_score);
}

/**
 * Format a ranking list for user presentation.
 * Shows the top N entries with score and key dimension highlights.
 * @param rankings - ProviderScore array (typically from rankProviders).
 * @param topN - Maximum entries to include (default 5).
 * @returns Human-readable formatted string.
 */
export function formatRanking(
  rankings: readonly ProviderScore[],
  topN = 5,
): string {
  const lines: string[] = [];
  for (let i = 0; i < Math.min(topN, rankings.length); i++) {
    const r = rankings[i]!;
    lines.push(
      `  ${i + 1}. ${r.toolName} (${r.provider}) — ` +
        `score: ${r.weighted_score.toFixed(2)} ` +
        `[fit=${r.task_fit.toFixed(1)} quality=${r.output_quality.toFixed(1)} ` +
        `control=${r.control.toFixed(1)} reliable=${r.reliability.toFixed(1)} ` +
        `cost=${r.cost_efficiency.toFixed(1)}]`,
    );
  }
  return lines.join('\n');
}
