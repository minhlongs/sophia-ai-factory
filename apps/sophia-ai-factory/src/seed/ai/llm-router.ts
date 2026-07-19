/**
 * Smart LLM Router — Phase 4C
 *
 * Pure decision helper: classify prompt complexity + select provider/model.
 * No network calls. No side effects. Safe to call anywhere (edge, tests).
 *
 * (Local-mode mekongd support has been deprecated and removed. All requests route to cloud.)
 */

import type { Complexity } from './provider-interface';

export { type Complexity } from './provider-interface';

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

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-provider integration (opt-in)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Migration guide:
//   Old:  const decision = route(prompt); // returns provider + model
//         // caller then dispatches to the right adapter manually
//
//   New:  const result = await multiProviderChat(prompt, messages, options, {
//            registry: myRegistry,
//            primaryProvider: 'openrouter',
//            fallbackProvider: 'anthropic',
//          });
//         // result.response.content has the text; result.providerId tells you
//         // which provider served the request; result.usedFallback flags fallback.
//
//   The old route() / selectRoute() / classifyComplexity() are UNCHANGED.
//   This block is purely additive — no existing caller is affected.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ChatMessage, ChatOptions } from './provider-interface';
import { ProviderRegistry } from './provider-registry';
import { MultiProviderRouter } from './multi-provider-router';
import { verifyFinalContext, compressIfNeeded } from './context-window-enforcer';

export interface MultiProviderChatOptions {
  /** Pre-built provider registry (health-aware). */
  registry: ProviderRegistry;
  /** Preferred provider for the selected complexity tier. */
  primaryProvider: 'openrouter' | 'anthropic';
  /** Fallback provider when primary is unhealthy or fails. */
  fallbackProvider: 'openrouter' | 'anthropic';
  /** Maximum providers to try (default 3). */
  maxFallbackAttempts?: number;
  /** Log per-request cost estimates (default true). */
  logCost?: boolean;
}

/**
 * Health-aware chat completion using the multi-provider router.
 *
 * Classifies prompt complexity, selects the best healthy provider from
 * the registry's fallback chain, and automatically falls back on
 * retryable errors (5xx, rate-limit, timeout).
 *
 * This function is OPT-IN. Existing `route()` / `selectRoute()` callers
 * are unaffected.
 *
 * @param prompt — User prompt (used for complexity classification).
 * @param messages — Full conversation history.
 * @param options — Chat options (model, maxTokens, temperature, etc.).
 * @param mpOptions — Multi-provider configuration.
 * @returns Routed result with response, provider used, and metadata.
 * @throws {AllProvidersFailedError} — All providers in the chain failed.
 */
export async function multiProviderChat(
  prompt: string,
  messages: ChatMessage[],
  options: ChatOptions,
  mpOptions: MultiProviderChatOptions,
): Promise<import('./multi-provider-router').RoutedChatResult> {
  const router = new MultiProviderRouter({
    registry: mpOptions.registry,
    primaryProvider: mpOptions.primaryProvider,
    fallbackProvider: mpOptions.fallbackProvider,
    maxFallbackAttempts: mpOptions.maxFallbackAttempts ?? 3,
    logCost: mpOptions.logCost ?? true,
  });
  return router.chat(prompt, messages, options);
}
