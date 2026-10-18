/**
 * Multi-provider chat integration helper for LLM Router.
 *
 * Layer: seed/ai
 */

import type { ChatMessage, ChatOptions } from './provider-interface';
import { ProviderRegistry } from './provider-registry';
import { MultiProviderRouter, type RoutedChatResult } from './multi-provider-router';

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
 */
export async function multiProviderChat(
  prompt: string,
  messages: ChatMessage[],
  options: ChatOptions,
  mpOptions: MultiProviderChatOptions,
): Promise<RoutedChatResult> {
  const router = new MultiProviderRouter({
    registry: mpOptions.registry,
    primaryProvider: mpOptions.primaryProvider,
    fallbackProvider: mpOptions.fallbackProvider,
    maxFallbackAttempts: mpOptions.maxFallbackAttempts ?? 3,
    logCost: mpOptions.logCost ?? true,
  });
  return router.chat(prompt, messages, options);
}
