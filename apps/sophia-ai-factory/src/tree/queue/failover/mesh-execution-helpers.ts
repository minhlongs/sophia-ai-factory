/**
 * Provider Execution Order & Timeout Helpers for GPU Mesh Failover.
 *
 * Layer: tree/queue/failover
 *
 * @module tree/queue/failover/mesh-execution-helpers
 */

import type {
  GpuProvider,
  VideoRenderJob,
} from '@/seed/types/video-render-queue';
import { DEFAULT_PROVIDER_CHAIN } from './types';

/**
 * Resolves the deduplicated provider execution order based on preferred order
 * and available executors, falling back to DEFAULT_PROVIDER_CHAIN.
 */
export function resolveProviderExecutionOrder<T>(
  providerExecutors: Partial<Record<GpuProvider, (job: VideoRenderJob) => Promise<T>>>,
  preferredProviderOrder?: GpuProvider[],
): GpuProvider[] {
  const baseOrder =
    preferredProviderOrder && preferredProviderOrder.length > 0
      ? preferredProviderOrder
      : DEFAULT_PROVIDER_CHAIN;

  const executionOrder: GpuProvider[] = [];
  for (const p of baseOrder) {
    if (providerExecutors[p] && !executionOrder.includes(p)) {
      executionOrder.push(p);
    }
  }

  for (const p of DEFAULT_PROVIDER_CHAIN) {
    if (providerExecutors[p] && !executionOrder.includes(p)) {
      executionOrder.push(p);
    }
  }

  return executionOrder;
}

/**
 * Runs a provider executor with a strict timeout guard.
 */
export function executeProviderWithTimeout<T>(
  executor: (job: VideoRenderJob) => Promise<T>,
  job: VideoRenderJob,
  provider: GpuProvider,
  timeoutMs: number,
): Promise<T> {
  const executionPromise = executor(job);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Execution timed out after ${timeoutMs}ms on provider ${provider}`));
    }, timeoutMs);
  });

  return Promise.race([executionPromise, timeoutPromise]);
}
