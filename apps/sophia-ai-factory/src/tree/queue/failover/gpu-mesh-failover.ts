/**
 * Mesh failover execution orchestrator.
 *
 * @module tree/queue/failover/gpu-mesh-failover
 */

import type {
  GpuProvider,
  VideoRenderJob,
} from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';
import {
  type ProviderAttemptRecord,
  type MeshExecutionResult,
  DEFAULT_PROVIDER_CHAIN,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './types';
import {
  type CircuitBreakerRegistry,
  globalGpuCircuitBreaker,
} from './heartbeat-monitor';
import { AllProvidersFailedError } from './task-reallocator';

/**
 * Execute a render job across the GPU provider mesh with automatic failover and circuit breaker protection
 */
export async function executeWithMeshFailover<T>(
  job: VideoRenderJob,
  providerExecutors: Partial<Record<GpuProvider, (job: VideoRenderJob) => Promise<T>>>,
  preferredProviderOrder?: GpuProvider[],
  options?: {
    circuitBreaker?: CircuitBreakerRegistry;
    timeoutMs?: number;
  },
): Promise<MeshExecutionResult<T>> {
  const circuitBreaker = options?.circuitBreaker || globalGpuCircuitBreaker;
  const timeoutMs = options?.timeoutMs || DEFAULT_CIRCUIT_BREAKER_CONFIG.executionTimeoutMs || 120_000;

  // Build provider order: preferred order first, falling back to default chain
  const baseOrder =
    preferredProviderOrder && preferredProviderOrder.length > 0
      ? preferredProviderOrder
      : DEFAULT_PROVIDER_CHAIN;

  // Deduplicate and filter to providers with an available executor
  const executionOrder: GpuProvider[] = [];
  for (const p of baseOrder) {
    if (providerExecutors[p] && !executionOrder.includes(p)) {
      executionOrder.push(p);
    }
  }

  // Also append any remaining providers from default chain if they have executors
  for (const p of DEFAULT_PROVIDER_CHAIN) {
    if (providerExecutors[p] && !executionOrder.includes(p)) {
      executionOrder.push(p);
    }
  }

  if (executionOrder.length === 0) {
    throw new Error(`No GPU provider executors supplied for job ${job.id}`);
  }

  const attempts: ProviderAttemptRecord[] = [];
  const startTime = Date.now();

  for (const provider of executionOrder) {
    const attemptStart = Date.now();

    // Check circuit breaker status
    if (!circuitBreaker.canAttempt(provider, attemptStart)) {
      attempts.push({
        provider,
        status: 'skipped_circuit_open',
        error: 'Circuit breaker is OPEN (cooldown in progress)',
        durationMs: 0,
      });
      logger.warn(`[gpu-mesh-failover] Skipping provider ${provider} for job ${job.id}: Circuit is OPEN`);
      continue;
    }

    const executor = providerExecutors[provider]!;

    try {
      logger.info(`[gpu-mesh-failover] Attempting job ${job.id} on provider ${provider}`);

      // Execute with timeout wrapper
      const executionPromise = executor(job);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Execution timed out after ${timeoutMs}ms on provider ${provider}`));
        }, timeoutMs);
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);
      const durationMs = Date.now() - attemptStart;

      circuitBreaker.recordSuccess(provider, durationMs);
      attempts.push({
        provider,
        status: 'success',
        durationMs,
      });

      logger.info(
        `[gpu-mesh-failover] Job ${job.id} rendered successfully via ${provider} in ${durationMs}ms`,
      );

      return {
        result,
        provider,
        attempts,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (err) {
      const durationMs = Date.now() - attemptStart;
      const errorMsg = err instanceof Error ? err.message : String(err);

      circuitBreaker.recordFailure(provider, err);
      attempts.push({
        provider,
        status: 'failed',
        error: errorMsg,
        durationMs,
      });

      logger.warn(
        `[gpu-mesh-failover] Provider ${provider} failed for job ${job.id} (${durationMs}ms): ${errorMsg}. Failing over to next provider...`,
      );
    }
  }

  // All providers failed
  const totalDurationMs = Date.now() - startTime;
  logger.error(
    `[gpu-mesh-failover] All providers in mesh exhausted for job ${job.id} (${totalDurationMs}ms)`,
    { attempts },
  );

  throw new AllProvidersFailedError(job.id, attempts);
}
