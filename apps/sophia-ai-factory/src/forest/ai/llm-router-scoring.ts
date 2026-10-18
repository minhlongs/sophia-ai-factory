/**
 * Smart LLM Router — Scoring-Based Provider Selection Helpers
 *
 * Layer: forest/ai
 *
 * @module forest/ai/llm-router-scoring
 */

import type { ProviderScore, TaskContext, ToolInfo } from '@/seed/ai/provider-scoring'
import { scoreProvider, rankProviders } from '@/seed/ai/provider-scoring'
import { createLogger } from '@/seed/utils/logger-utility'

const logger = createLogger('forest/ai/llm-router')

/**
 * Score and rank available providers for a given task context.
 *
 * Uses the 7-dimension scoring engine to pick the best provider among
 * registered options. Falls back to the classic routing matrix if no
 * providers are registered or scoring yields no usable result.
 *
 * @param tools - Array of provider metadata to score.
 * @param taskContext - Task description and constraints.
 * @returns ProviderScore[] sorted best-first, or empty array if no tools.
 */
export function rankProvidersForTask(
  tools: readonly ToolInfo[],
  taskContext: TaskContext,
): ProviderScore[] {
  if (tools.length === 0) {
    logger.warn('No tools provided for provider scoring')
    return []
  }

  const rankings = rankProviders(tools, taskContext)
  logger.info('Provider ranking computed', {
    topProvider: rankings[0]?.provider,
    topScore: rankings[0]?.weighted_score.toFixed(3),
    totalCandidates: rankings.length,
  })

  return rankings
}

/**
 * Select the best provider using 7-dimension scoring.
 *
 * Wraps `rankProvidersForTask` and returns just the top-ranked provider
 * score, or undefined if no providers are available.
 *
 * @param tools - Array of provider metadata implementing ToolInfo.
 * @param taskContext - Task description and constraints.
 * @returns The highest-scoring ProviderScore, or undefined.
 */
export function selectBestProvider(
  tools: readonly ToolInfo[],
  taskContext: TaskContext,
): ProviderScore | undefined {
  const rankings = rankProvidersForTask(tools, taskContext)
  return rankings[0]
}

/**
 * Score a single provider against a task context.
 *
 * Delegates to the scoring engine. Useful when you already know which
 * provider to evaluate and want the full 7-dimension breakdown.
 *
 * @param tool - Provider metadata implementing ToolInfo.
 * @param taskContext - Task description and constraints.
 * @returns ProviderScore with all dimensions populated.
 */
export function scoreProviderForTask(
  tool: ToolInfo,
  taskContext: TaskContext,
): ProviderScore {
  return scoreProvider(tool, taskContext)
}
