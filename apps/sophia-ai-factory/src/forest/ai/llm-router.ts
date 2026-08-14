/**
 * Smart LLM Router — Phase 4C
 *
 * Pure decision helper: classify prompt complexity + select provider/model.
 * No network calls. No side effects. Safe to call anywhere (edge, tests).
 *
 * (Local-mode mekongd support has been deprecated and removed. All requests route to cloud.)
 */

import type { Complexity } from '@/seed/ai/provider-interface'
import type { ProviderScore, TaskContext, ToolInfo } from '@/seed/ai/provider-scoring'
import { scoreProvider, rankProviders } from '@/seed/ai/provider-scoring'
import { createLogger } from '@/seed/utils/logger-utility'

const logger = createLogger('forest/ai/llm-router')

export { type Complexity } from '@/seed/ai/provider-interface'
export { multiProviderChat, type MultiProviderChatOptions } from '@/seed/ai/llm-router'

export interface RouteDecision {
  provider: 'openrouter' | 'anthropic'
  model: string
  complexity: Complexity
  reason: string
}

// ── Keyword tables (EN + VN, lowercased) ─────────────────────────────────────

const COMPLEX_KEYWORDS = [
  'explain', 'analyze', 'compare', 'design', 'architect', 'refactor',
  'reason', 'evaluate', 'synthesize', 'investigate',
  'phân tích', 'thiết kế', 'so sánh', 'đánh giá', 'tổng hợp',
] as const

const SIMPLE_KEYWORDS = [
  'summarize', 'translate', 'hello', 'what is', 'define',
  'simple', 'quick', 'basic', 'list',
  'tóm tắt', 'dịch', 'chào', 'là gì', 'định nghĩa',
] as const

// ── Thresholds (tuned to match PDF heuristic) ────────────────────────────────

const COMPLEX_LEN_THRESHOLD = 500
const MEDIUM_LEN_THRESHOLD = 200
const COMPLEX_SCORE_TRIP = 2

/**
 * Classify a prompt into one of 3 complexity tiers.
 * Pure + deterministic — same prompt always returns the same tier.
 */
export function classifyComplexity(prompt: string): Complexity {
  const text = prompt.toLowerCase()
  const length = prompt.length

  let complexScore = 0
  for (const kw of COMPLEX_KEYWORDS) {
    if (text.includes(kw)) complexScore++
  }

  let simpleScore = 0
  for (const kw of SIMPLE_KEYWORDS) {
    if (text.includes(kw)) simpleScore++
  }

  if (length > COMPLEX_LEN_THRESHOLD || complexScore >= COMPLEX_SCORE_TRIP) {
    return 'complex'
  }
  if (length > MEDIUM_LEN_THRESHOLD || (complexScore > 0 && simpleScore === 0)) {
    return 'medium'
  }
  return 'simple'
}

// ── Routing matrix ───────────────────────────────────────────────────────────

const CLOUD_MODELS: Record<Complexity, { provider: 'openrouter' | 'anthropic'; model: string }> = {
  simple: { provider: 'openrouter', model: 'gpt-4o-mini' },
  medium: { provider: 'openrouter', model: 'gpt-4o-mini' },
  complex: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
}

/**
 * Pick provider + model for a classified prompt.
 *
 * @param complexity — result of `classifyComplexity()`
 * @param _hasLocalMode — (deprecated) ignored, local mode is removed.
 */
export function selectRoute(
  complexity: Complexity,
  _hasLocalMode?: boolean,
): RouteDecision {
  const cloud = CLOUD_MODELS[complexity]
  return {
    provider: cloud.provider,
    model: cloud.model,
    complexity,
    reason: `cloud:${complexity}`,
  }
}

/**
 * Convenience: classify + select in one call.
 */
export function route(prompt: string, _hasLocalMode?: boolean): RouteDecision {
  return selectRoute(classifyComplexity(prompt), _hasLocalMode)
}

// ── Scoring-based provider selection ─────────────────────────────────────────

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
