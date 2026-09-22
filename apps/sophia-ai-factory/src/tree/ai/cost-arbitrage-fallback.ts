/**
 * @module tree/ai/cost-arbitrage-fallback
 *
 * Automated Circuit Breaker & Failover Engine (Requirement R4)
 *
 * Implements resilient multi-provider failover:
 * - Scoped per-tenant circuit breaker integration
 * - Instant fallback to secondary cloud provider upon exception or latency threshold
 * - Latency SLA enforcement (fails over if execution exceeds threshold)
 * - Automatic probe recovery on HALF_OPEN state
 *
 * Layer Rule: tree layer — can import seed/ and tree/*, cannot import forest/ or land/.
 */

import { createLogger } from '@/seed/utils/logger-utility';
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
  getState,
  reset,
} from '@/seed/security/circuit-breaker';
import {
  classifyError,
} from '@/seed/types/failure-kind';
import type {
  FallbackExecutionResult,
  PipelineStage,
  ProviderHealthStatus,
} from '@/seed/types/unit-economics-types';

const logger = createLogger('tree/ai/cost-arbitrage-fallback');

export const DEFAULT_LATENCY_THRESHOLD_MS = 6_000; // 6 seconds SLA ceiling

// ─── Default Fallback Chains ──────────────────────────────────────────────────

export const DEFAULT_FALLBACK_CHAINS: Record<PipelineStage, Record<string, string[]>> = {
  script: {
    mekong: ['openrouter', 'anthropic'],
    openrouter: ['anthropic', 'mekong'],
    anthropic: ['openrouter', 'mekong'],
  },
  visuals: {
    mekong: ['fal', 'cloud_flux_dev'],
    fal: ['mekong', 'cloud_flux_dev'],
    cloud_flux_dev: ['fal', 'mekong'],
  },
  audio: {
    mekong: ['elevenlabs', 'fish-speech'],
    elevenlabs: ['fish-speech', 'mekong'],
    'fish-speech': ['elevenlabs', 'mekong'],
  },
  render: {
    mekong: ['openrouter', 'fal'],
    openrouter: ['fal', 'mekong'],
    fal: ['openrouter', 'mekong'],
  },
};

/**
 * Returns ordered list of fallback providers for a given stage and primary provider.
 */
export function getFallbackChain(stage: PipelineStage, primaryProvider: string): string[] {
  const stageChains = DEFAULT_FALLBACK_CHAINS[stage];
  if (stageChains && stageChains[primaryProvider]) {
    return stageChains[primaryProvider];
  }
  // Generic fallback if provider not explicitly mapped
  return ['openrouter', 'fal', 'elevenlabs'].filter((p) => p !== primaryProvider);
}

/**
 * Evaluates real-time health and circuit breaker status for a specific provider.
 */
export function evaluateProviderHealth(
  provider: string,
  tenantKeyRef = 'platform',
): ProviderHealthStatus {
  const entry = getState(provider, tenantKeyRef);
  const isAvailable = shouldAllowRequest(provider, tenantKeyRef);

  return {
    provider,
    circuitState: entry.state,
    isAvailable,
    failureCount: entry.failureCount,
    consecutiveNetworkFailures: entry.consecutiveConnectionFailures ?? 0,
    cooldownUntil: entry.cooldownUntil,
    lastFailureAt: entry.lastFailureAt,
  };
}

export interface FallbackExecutionParams<T> {
  stage: PipelineStage;
  primaryProvider: string;
  execute: (provider: string) => Promise<T>;
  fallbackChain?: string[];
  tenantKeyRef?: string;
  latencyThresholdMs?: number;
}

/**
 * Executes a pipeline stage with automated failover and circuit breaker tracking.
 *
 * Sequence:
 * 1. Checks if primary provider is healthy via circuit breaker.
 * 2. If unhealthy, immediately skips to the first healthy fallback provider.
 * 3. Measures latency. If execution times out or exceeds latency SLA, records failure and falls back.
 * 4. On exception, classifies error, trips/increments breaker, and moves to next fallback.
 * 5. On success, records success and resets failure counter.
 */
export async function executeWithCostFallback<T>(
  params: FallbackExecutionParams<T>,
): Promise<FallbackExecutionResult<T>> {
  const {
    stage,
    primaryProvider,
    execute,
    tenantKeyRef = 'platform',
    latencyThresholdMs = DEFAULT_LATENCY_THRESHOLD_MS,
  } = params;

  const fallbackProviders =
    params.fallbackChain ?? getFallbackChain(stage, primaryProvider);
  const providerCandidates = [primaryProvider, ...fallbackProviders];

  let lastError: Error | null = null;
  let attemptsCount = 0;

  for (let i = 0; i < providerCandidates.length; i++) {
    const candidate = providerCandidates[i];
    attemptsCount++;

    const isPrimary = candidate === primaryProvider;
    const isAllowed = shouldAllowRequest(candidate, tenantKeyRef);

    if (!isAllowed) {
      logger.warn('ARBITRAGE_CIRCUIT_OPEN_SKIPPED', {
        stage,
        provider: candidate,
        tenantKeyRef,
        attempt: attemptsCount,
      });
      continue;
    }

    const startTime = Date.now();

    try {
      // Execute candidate with latency threshold guard
      const resultPromise = execute(candidate);

      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Execution on ${candidate} exceeded SLA threshold of ${latencyThresholdMs}ms`));
        }, latencyThresholdMs);
      });

      const outcome = await Promise.race([resultPromise, timeoutPromise]);
      if (timeoutHandle) clearTimeout(timeoutHandle);

      const latencyMs = Date.now() - startTime;

      // Successful execution: record success in circuit breaker
      recordSuccess(candidate, tenantKeyRef);

      const fallbackTriggered = !isPrimary;

      if (fallbackTriggered) {
        logger.info('ARBITRAGE_FALLBACK_SUCCESS', {
          stage,
          originalPrimary: primaryProvider,
          providerUsed: candidate,
          latencyMs,
          attempts: attemptsCount,
        });
      }

      return {
        result: outcome,
        providerUsed: candidate,
        fallbackTriggered,
        primaryProvider,
        fallbackReason: fallbackTriggered ? (lastError?.message ?? 'Primary provider unavailable') : undefined,
        latencyMs,
        attemptsCount,
      };
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      lastError = errorObj;
      const latencyMs = Date.now() - startTime;
      const kind = classifyError(errorObj);

      logger.warn('ARBITRAGE_STAGE_EXECUTION_FAILURE', {
        stage,
        provider: candidate,
        kind,
        error: errorObj.message,
        latencyMs,
        attempts: attemptsCount,
      });

      // Record failure on failing provider
      recordFailure(candidate, kind, tenantKeyRef);

      // Continue to next provider in fallback chain
    }
  }

  // If all providers failed, throw composite error
  throw new Error(
    `All providers in fallback chain exhausted for stage "${stage}". Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Manually resets circuit breaker state for a provider.
 */
export function resetProviderHealth(provider: string, tenantKeyRef = 'platform'): void {
  reset(provider, tenantKeyRef);
  logger.info('ARBITRAGE_PROVIDER_RESET', { provider, tenantKeyRef });
}
