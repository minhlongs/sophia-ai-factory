/**
 * @module seed/ai/multi-provider-router
 *
 * Enhanced multi-provider router with fallback chain.
 *
 * Flow:
 * 1. Classify prompt complexity (simple / medium / complex)
 * 2. Select primary provider based on complexity + registry health
 * 3. Try primary provider with retryable-error handling
 * 4. On failure, walk the fallback chain from the registry
 * 5. Return result or throw the last error
 *
 * Integrates with ProviderRegistry for health-aware routing.
 * Backward compatible: existing route() and selectRoute() from llm-router.ts
 * still work unchanged.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type {
  Provider,
  ProviderId,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  Complexity,
} from './provider-interface';
import { ProviderRegistry } from './provider-registry';
import { classifyComplexity, selectRoute } from './llm-router';
import { logger } from '@/seed/utils/logger-utility';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RoutedChatResult {
  response: ChatResponse
  providerId: ProviderId
  complexity: Complexity
  usedFallback: boolean
  estimatedCost: number
  attempts: number
}

export interface MultiProviderRouterOptions {
  registry: ProviderRegistry
  primaryProvider: ProviderId
  fallbackProvider: ProviderId
  maxFallbackAttempts?: number
  logCost?: boolean
}

export class AllProvidersFailedError extends Error {
  readonly attempts: number
  readonly lastProviderId: ProviderId
  readonly lastError: Error

  constructor(attempts: number, lastProviderId: ProviderId, lastError: Error) {
    super(`All ${attempts} provider(s) failed. Last: ${lastProviderId} — ${lastError.message}`)
    this.name = 'AllProvidersFailedError'
    this.attempts = attempts
    this.lastProviderId = lastProviderId
    this.lastError = lastError
  }
}

// ── Router ─────────────────────────────────────────────────────────────────────

export class MultiProviderRouter {
  private readonly registry: ProviderRegistry
  private readonly primaryProvider: ProviderId
  private readonly fallbackProvider: ProviderId
  private readonly maxFallbackAttempts: number
  private readonly logCost: boolean

  constructor(options: MultiProviderRouterOptions) {
    this.registry = options.registry
    this.primaryProvider = options.primaryProvider
    this.fallbackProvider = options.fallbackProvider
    this.maxFallbackAttempts = options.maxFallbackAttempts ?? 3
    this.logCost = options.logCost ?? true
  }

  async chat(prompt: string, messages: ChatMessage[], options: ChatOptions): Promise<RoutedChatResult> {
    const complexity = classifyComplexity(prompt)
    const routeDecision = selectRoute(complexity)

    const chain = this.registry.getFallbackChain(routeDecision.provider, [this.fallbackProvider])

    if (chain.length === 0) {
      throw new Error('No healthy providers available in the fallback chain')
    }

    let lastError: Error | null = null
    let lastProviderId: ProviderId = chain[0].id

    for (let attempt = 0; attempt < Math.min(chain.length, this.maxFallbackAttempts); attempt++) {
      const entry = chain[attempt]
      lastProviderId = entry.id
      const provider = entry.provider

      try {
        const response = await provider.chat(messages, options)

        this.registry.updateHealth(provider.id, response.latencyMs)

        const estimatedCost = response.usage.inputTokens > 0 || response.usage.outputTokens > 0
          ? provider.estimateCost(messages, options.model ?? response.model, options)
          : 0

        if (this.logCost && estimatedCost > 0) {
          logger.info('[MultiProviderRouter] Request cost estimated', undefined, {
            providerId: provider.id,
            model: response.model,
            estimatedCostUsd: estimatedCost.toFixed(6),
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            complexity,
            usedFallback: attempt > 0,
          })
        }

        return {
          response,
          providerId: provider.id,
          complexity,
          usedFallback: attempt > 0,
          estimatedCost,
          attempts: attempt + 1,
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        lastError = error

        const retryable = this.isRetryable(error)
        const isLastAttempt = attempt >= Math.min(chain.length, this.maxFallbackAttempts) - 1

        logger.warn('[MultiProviderRouter] Provider failed', undefined, {
          providerId: provider.id,
          attempt: attempt + 1,
          maxAttempts: Math.min(chain.length, this.maxFallbackAttempts),
          error: error.message,
          retryable,
          isLastAttempt,
          complexity,
        })

        this.registry.recordFailure(provider.id, error)

        if (!retryable || isLastAttempt) {
          break
        }
      }
    }

    throw new AllProvidersFailedError(
      Math.min(chain.length, this.maxFallbackAttempts),
      lastProviderId,
      lastError ?? new Error('Unknown error'),
    )
  }

  async *stream(
    prompt: string,
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk & { providerId?: ProviderId; usedFallback?: boolean }, void, unknown> {
    const complexity = classifyComplexity(prompt)
    const routeDecision = selectRoute(complexity)
    const chain = this.registry.getFallbackChain(routeDecision.provider, [this.fallbackProvider])

    if (chain.length === 0) {
      throw new Error('No healthy providers available in the fallback chain')
    }

    let lastError: Error | null = null
    let lastProviderId: ProviderId = chain[0].id

    for (let attempt = 0; attempt < Math.min(chain.length, this.maxFallbackAttempts); attempt++) {
      const entry = chain[attempt]
      lastProviderId = entry.id
      const provider = entry.provider
      let yieldedAny = false

      try {
        const startTime = performance.now()

        for await (const chunk of provider.stream(messages, options)) {
          yieldedAny = true
          yield {
            ...chunk,
            providerId: provider.id,
            usedFallback: attempt > 0,
          }
        }

        const latencyMs = Math.round(performance.now() - startTime)
        this.registry.updateHealth(provider.id, latencyMs)

        logger.debug('[MultiProviderRouter] Stream completed', undefined, {
          providerId: provider.id,
          complexity,
          usedFallback: attempt > 0,
          attempts: attempt + 1,
        })

        return
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        lastError = error

        const retryable = this.isRetryable(error)
        const isLastAttempt = attempt >= Math.min(chain.length, this.maxFallbackAttempts) - 1

        logger.warn('[MultiProviderRouter] Stream provider failed', undefined, {
          providerId: provider.id,
          attempt: attempt + 1,
          error: error.message,
          retryable,
          yieldedAny,
          isLastAttempt,
          complexity,
        })

        this.registry.recordFailure(provider.id, error)

        if (yieldedAny) {
          throw new AllProvidersFailedError(attempt + 1, provider.id, error)
        }

        if (!retryable || isLastAttempt) {
          break
        }
      }
    }

    throw new AllProvidersFailedError(
      Math.min(chain.length, this.maxFallbackAttempts),
      lastProviderId,
      lastError ?? new Error('Unknown error'),
    )
  }

  private isRetryable(error: Error): boolean {
    const retryableFlag = (error as { retryable?: boolean }).retryable
    if (retryableFlag === false) return false
    if (retryableFlag === true) return true

    const msg = error.message.toLowerCase()

    if (msg.includes('401') || msg.includes('403') || msg.includes('invalid key') || msg.includes('auth failed')) {
      return false
    }
    if (msg.includes('400') || msg.includes('bad request') || msg.includes('invalid request')) {
      return false
    }
    if (
      msg.includes('5xx') || msg.includes('500') || msg.includes('502') ||
      msg.includes('503') || msg.includes('504') || msg.includes('429') ||
      msg.includes('rate limit') || msg.includes('timeout') || msg.includes('timed out') ||
      msg.includes('econnreset') || msg.includes('enotfound') || msg.includes('network') ||
      msg.includes('circuit breaker')
    ) {
      return true
    }

    return true
  }
}
