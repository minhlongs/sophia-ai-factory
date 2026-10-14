/**
 * Stream fallback generator and logging helpers for MultiProviderRouter.
 * @module seed/ai/router/multi-provider-stream-runner
 */

import type {
  ProviderId,
  ChatMessage,
  ChatOptions,
  MultiProviderRouterOptions,
  StreamResultChunk,
} from './types';
import { AllProvidersFailedError } from './types';
import { isRetryableError } from './retry-policy';
import { classifyComplexity, selectRoute } from '../llm-router';
import { logger } from '@/seed/utils/logger-utility';

export async function* executeMultiProviderStream(params: {
  registry: MultiProviderRouterOptions['registry'];
  fallbackProvider: ProviderId;
  maxFallbackAttempts: number;
  prompt: string;
  messages: ChatMessage[];
  options: ChatOptions;
}): AsyncGenerator<StreamResultChunk, void, unknown> {
  const { registry, fallbackProvider, maxFallbackAttempts, prompt, messages, options } = params;
  const complexity = classifyComplexity(prompt);
  const routeDecision = selectRoute(complexity);
  const chain = registry.getFallbackChain(routeDecision.provider, [fallbackProvider]);

  if (chain.length === 0) {
    throw new Error('No healthy providers available in the fallback chain');
  }

  let lastError: Error | null = null;
  let lastProviderId: ProviderId = chain[0].id;

  for (let attempt = 0; attempt < Math.min(chain.length, maxFallbackAttempts); attempt++) {
    const entry = chain[attempt];
    lastProviderId = entry.id;
    const provider = entry.provider;
    let yieldedAny = false;

    try {
      const startTime = performance.now();

      for await (const chunk of provider.stream(messages, options)) {
        yieldedAny = true;
        yield {
          ...chunk,
          providerId: provider.id,
          usedFallback: attempt > 0,
        };
      }

      const latencyMs = Math.round(performance.now() - startTime);
      registry.updateHealth(provider.id, latencyMs);

      logger.debug('[MultiProviderRouter] Stream completed', undefined, {
        providerId: provider.id,
        complexity,
        usedFallback: attempt > 0,
        attempts: attempt + 1,
      });

      return;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      const retryable = isRetryableError(error);
      const isLastAttempt = attempt >= Math.min(chain.length, maxFallbackAttempts) - 1;

      logger.warn('[MultiProviderRouter] Stream provider failed', undefined, {
        providerId: provider.id,
        attempt: attempt + 1,
        error: error.message,
        retryable,
        yieldedAny,
        isLastAttempt,
        complexity,
      });

      registry.recordFailure(provider.id, error);

      if (yieldedAny) {
        throw new AllProvidersFailedError(attempt + 1, provider.id, error);
      }

      if (!retryable || isLastAttempt) {
        break;
      }
    }
  }

  throw new AllProvidersFailedError(
    Math.min(chain.length, maxFallbackAttempts),
    lastProviderId,
    lastError ?? new Error('Unknown error'),
  );
}
