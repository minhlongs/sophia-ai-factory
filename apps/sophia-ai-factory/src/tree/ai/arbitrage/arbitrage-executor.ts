import { createLogger } from '@/seed/utils/logger-utility';
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { FallbackExecutionResult } from '@/seed/types/unit-economics-types';
import { DEFAULT_LATENCY_THRESHOLD_MS, type FallbackExecutionParams } from './types';
import { getFallbackChain } from './fallback-chain';

const logger = createLogger('tree/ai/cost-arbitrage-fallback');

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

      recordFailure(candidate, kind, tenantKeyRef);
    }
  }

  throw new Error(
    `All providers in fallback chain exhausted for stage "${stage}". Last error: ${lastError?.message || 'Unknown error'}`
  );
}
