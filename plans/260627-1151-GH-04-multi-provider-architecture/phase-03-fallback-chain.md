# Phase 4.3 — Fallback Chain

**Status:** Design  
**Layer:** forest/llm (new)

## Context Links

- Phase 4.1: `phase-01-provider-interface.md` (LLMProvider, ProviderError)
- Phase 4.2: `phase-02-provider-registry.md` (ProviderRegistry)
- Existing fallback pattern: `land/agent-chat/llm-router.ts` (DeepSeek → Anthropic)

## Requirements

1. Define fallback chains per user tier or task type
2. Automatic fallback when primary provider throws retryable error
3. Configurable chain order (not hardcoded)
4. Preserve error context through chain (which provider failed, why)
5. Stop at first success or exhaust chain
6. Log each fallback hop for observability

## Architecture

### New Files

```
forest/llm/
├── fallback-chain.ts          # FallbackChain class
├── fallback-chain.test.ts     # Tests
└── index.ts                   # Updated barrel
```

### Design

```typescript
// forest/llm/fallback-chain.ts

import type {
  LLMProvider,
  ProviderId,
  ProviderError,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  CostEstimate,
} from '@/seed/types/llm-provider';
import { createLogger } from '@/seed/utils/logger-utility';

export interface FallbackChainOptions {
  /** Provider ids in priority order (first = primary) */
  providerIds: ProviderId[];
  /** Max total timeout across all providers in chain */
  totalTimeoutMs?: number;
  /** Retries per provider before falling back (default: 1) */
  retriesPerProvider?: number;
  /** Retry delay in ms (default: 500) */
  retryDelayMs?: number;
  /** Only fall back on retryable errors (default: true) */
  onlyRetryableErrors?: boolean;
}

export interface FallbackResult<T> {
  success: boolean;
  result: T | null;
  providerId: ProviderId;
  attempts: number;
  chain: Array<{
    providerId: ProviderId;
    error?: ProviderError;
    latencyMs: number;
  }>;
  totalLatencyMs: number;
}

export class FallbackChain {
  private readonly log = createLogger('forest/llm/fallback-chain');
  private readonly options: Required<FallbackChainOptions>;

  constructor(options: FallbackChainOptions) {
    this.options = {
      providerIds: options.providerIds,
      totalTimeoutMs: options.totalTimeoutMs ?? 30_000,
      retriesPerProvider: options.retriesPerProvider ?? 1,
      retryDelayMs: options.retryDelayMs ?? 500,
      onlyRetryableErrors: options.onlyRetryableErrors ?? true,
    };
  }

  async chat(
    providers: Map<ProviderId, LLMProvider>,
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<FallbackResult<ChatResponse>> {
    return this.executeWithFallback(
      providers,
      messages,
      options,
      async (provider, msgs, opts) => provider.chat(msgs, opts),
    );
  }

  async stream(
    providers: Map<ProviderId, LLMProvider>,
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<FallbackResult<AsyncIterable<StreamChunk>>> {
    return this.executeWithFallback(
      providers,
      messages,
      options,
      async (provider, msgs, opts) => provider.stream(msgs, opts),
    );
  }

  async estimateCost(
    providers: Map<ProviderId, LLMProvider>,
    messages: ChatMessage[],
    estimatedOutputTokens: number,
  ): Promise<FallbackResult<CostEstimate>> {
    return this.executeWithFallback(
      providers,
      messages,
      undefined,
      async (provider, msgs, _opts, estTokens) =>
        provider.estimateCost(msgs, estTokens),
      estimatedOutputTokens,
    );
  }

  // ── Internal ────────────────────────────────────────────────────────

  private async executeWithFallback<T>(
    providers: Map<ProviderId, LLMProvider>,
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    fn: (
      provider: LLMProvider,
      messages: ChatMessage[],
      options: ChatOptions | undefined,
      extra?: number,
    ) => Promise<T>,
    extra?: number,
  ): Promise<FallbackResult<T>> {
    const chain: FallbackResult<T>['chain'] = [];
    const startTime = Date.now();

    for (const providerId of this.options.providerIds) {
      const provider = providers.get(providerId);
      if (!provider) {
        this.log.warn(`provider not found in registry, skipping`, { providerId });
        continue;
      }

      for (let attempt = 0; attempt <= this.options.retriesPerProvider; attempt++) {
        const attemptStart = Date.now();
        try {
          const result = await fn(provider, messages, options, extra);
          const latencyMs = Date.now() - attemptStart;

          chain.push({ providerId, latencyMs });
          this.log.info(`provider succeeded`, {
            providerId,
            attempt,
            latencyMs,
            totalChainHops: chain.length,
          });

          return {
            success: true,
            result,
            providerId,
            attempts: attempt + 1,
            chain,
            totalLatencyMs: Date.now() - startTime,
          };
        } catch (err) {
          const latencyMs = Date.now() - attemptStart;
          const providerError =
            err instanceof ProviderError
              ? err
              : new ProviderError({
                  code: 'UNKNOWN',
                  providerId,
                  message: err instanceof Error ? err.message : 'unknown error',
                  cause: err instanceof Error ? err : undefined,
                });

          chain.push({ providerId, error: providerError, latencyMs });

          // Decide: retry this provider, or fall through to next
          const shouldRetry =
            attempt < this.options.retriesPerProvider &&
            (providerError.retryable ||
              providerError.code === 'TIMEOUT' ||
              providerError.code === 'RATE_LIMITED');

          if (shouldRetry) {
            this.log.warn(`provider retry`, {
              providerId,
              attempt,
              code: providerError.code,
              retryable: providerError.retryable,
            });
            await this.delay(this.options.retryDelayMs);
            continue;
          }

          // Fall through to next provider in chain
          const shouldFallback =
            !this.options.onlyRetryableErrors || providerError.retryable;
          if (!shouldFallback) {
            this.log.error(`non-retryable error, aborting chain`, {
              providerId,
              code: providerError.code,
            });
            return {
              success: false,
              result: null,
              providerId,
              attempts: attempt + 1,
              chain,
              totalLatencyMs: Date.now() - startTime,
            };
          }

          this.log.warn(`falling back to next provider`, {
            providerId,
            code: providerError.code,
            chainSoFar: chain.map((c) => c.providerId),
          });
          break; // next provider
        }
      }
    }

    // Chain exhausted
    return {
      success: false,
      result: null,
      providerId: this.options.providerIds[this.options.providerIds.length - 1],
      attempts: chain.reduce((sum, c) => sum + 1, 0),
      chain,
      totalLatencyMs: Date.now() - startTime,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### Default Chains (per tier)

```typescript
// forest/llm/default-chains.ts

import type { ProviderId } from '@/seed/types/llm-provider';

/** Default fallback chains keyed by user tier */
export const DEFAULT_FALLBACK_CHAINS: Record<string, ProviderId[]> = {
  // Lite tier: cheapest providers first
  lite: ['deepseek', 'openrouter', 'anthropic'],
  // Standard: balance cost + quality
  standard: ['deepseek', 'anthropic', 'openrouter'],
  // Max: best quality first, cost secondary
  max: ['anthropic', 'deepseek', 'openrouter'],
  // Default fallback (no tier context)
  default: ['deepseek', 'anthropic'],
};
```

## Files to Create

| File | Purpose |
|------|---------|
| `forest/llm/fallback-chain.ts` | FallbackChain class with chat/stream/estimateCost |
| `forest/llm/default-chains.ts` | Tier-keyed default provider order |
| `forest/llm/fallback-chain.test.ts` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `forest/llm/index.ts` | Add exports |

## Tests

- Successful primary provider (no fallback needed)
- Primary fails, secondary succeeds (1 hop)
- All providers fail (chain exhausted)
- Non-retryable error aborts chain immediately
- Retry with delay before falling back
- `estimateCost` uses first healthy provider (no need to try all)
