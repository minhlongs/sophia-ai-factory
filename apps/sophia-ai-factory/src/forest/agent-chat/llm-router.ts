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
import { buildCatalog, type LlmCatalogEntry } from './llm-catalog';

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
  const sortedByContext = [...catalog].sort((a, b) => b.contextWindow - a.contextWindow);

  let bestFit: LlmCatalogEntry | null = null;
  for (const entry of sortedByContext) {
    if (entry.contextWindow >= requiredContext) {
      bestFit = entry;
      break;
    }
  }

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
