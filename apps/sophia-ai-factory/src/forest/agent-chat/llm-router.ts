/**
 * Agent Chat — LLM Route Resolver
 *
 * Priority: DeepSeek cloud R1 → Anthropic Claude fallback.
 * Returns LlmRoute with provider/baseUrl/apiKey/model ready for OpenAI-compat API call.
 *
 * Supports context-aware routing: for long conversations, selects a model
 * with a larger context window to avoid truncation.
 *
 * @module forest/agent-chat/llm-router
 */

import { logger } from '@/seed/utils/logger-utility';
import type { LlmRoute } from './types';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

// ── Model context windows (tokens) ─────────────────────────────────────────────

function buildCatalog(): Array<{ model: string; provider: LlmRoute['provider']; baseUrl: string; apiKey: string; contextWindow: number }> {
  const catalog: Array<{ model: string; provider: LlmRoute['provider']; baseUrl: string; apiKey: string; contextWindow: number }> = [];

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    catalog.push({
      model: 'deepseek-reasoner',
      provider: 'deepseek',
      baseUrl: DEEPSEEK_BASE_URL,
      apiKey: deepseekKey,
      contextWindow: 64000,
    });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    catalog.push({
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      baseUrl: ANTHROPIC_BASE_URL,
      apiKey: anthropicKey,
      contextWindow: 200000,
    });
    // Fallback with smaller context.
    catalog.push({
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      baseUrl: ANTHROPIC_BASE_URL,
      apiKey: anthropicKey,
      contextWindow: 8192,
    });
  }

  return catalog;
}

// ── Options ────────────────────────────────────────────────────────────────────

/**
 * Options for LLM route resolution.
 */
export interface ResolveLlmRouteOptions {
  /** Estimated token count of the conversation (for context-aware routing). */
  estimatedTokens?: number;
  /** Minimum context window required (defaults to estimatedTokens if not provided). */
  minContextWindow?: number;
}

/**
 * Resolve which LLM backend to use for a given user.
 *
 * If estimatedTokens is provided, selects a model whose context window
 * can accommodate the conversation. Falls back to the default route
 * if no suitable model is found.
 *
 * Throws 'NO_LLM_CONFIGURED' if no provider is available.
 */
export async function resolveLlmRoute(
  userId: string,
  options?: ResolveLlmRouteOptions,
): Promise<LlmRoute> {
  const catalog = buildCatalog();

  if (catalog.length === 0) {
    throw new Error('NO_LLM_CONFIGURED');
  }

  // If no token estimate provided, return the highest-capability default (first entry).
  if (!options?.estimatedTokens && !options?.minContextWindow) {
    const defaultRoute = catalog[0];
    logger.info('[LlmRouter] Resolved default route', {
      userId,
      provider: defaultRoute.provider,
      model: defaultRoute.model,
    });
    return {
      provider: defaultRoute.provider,
      baseUrl: defaultRoute.baseUrl,
      apiKey: defaultRoute.apiKey,
      model: defaultRoute.model,
    };
  }

  const requiredContext = options.minContextWindow ?? options.estimatedTokens ?? 0;

  // Sort by context window descending, then pick the smallest model that fits.
  const sortedByContext = [...catalog].sort((a, b) => b.contextWindow - a.contextWindow);

  // Find the best fit: smallest context window that still fits the conversation.
  let bestFit: (typeof catalog)[0] | null = null;
  for (const entry of sortedByContext) {
    if (entry.contextWindow >= requiredContext) {
      bestFit = entry;
      break;
    }
  }

  // If no model fits, use the largest available (will truncate upstream).
  const selected = bestFit ?? sortedByContext[0];

  logger.info('[LlmRouter] Context-aware route resolved', {
    userId,
    provider: selected.provider,
    model: selected.model,
    contextWindow: selected.contextWindow,
    requiredContext,
    usedFallback: bestFit === null,
  });

  return {
    provider: selected.provider,
    baseUrl: selected.baseUrl,
    apiKey: selected.apiKey,
    model: selected.model,
  };
}
