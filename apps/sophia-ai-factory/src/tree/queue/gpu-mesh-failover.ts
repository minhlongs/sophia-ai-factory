/**
 * Multi-Provider GPU Mesh Failover & Circuit Breaker Engine
 *
 * Layer: tree/queue (Domain services & reliability patterns)
 *
 * Implements:
 * - Multi-provider fallback mesh across: fal.ai -> RunPod -> Replicate -> Mekong GPU
 * - Circuit breaker pattern per provider (CLOSED, OPEN, HALF_OPEN)
 * - Automatic failover upon 5xx, timeouts, or GPU errors
 *
 * @module tree/queue/gpu-mesh-failover
 */

import type {
  GpuProvider,
  CircuitBreakerState,
  ProviderHealthStatus,
  VideoRenderJob,
} from '@/seed/types/video-render-queue';
import { ALL_GPU_PROVIDERS } from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Default fallback chain across providers
 */
export const DEFAULT_PROVIDER_CHAIN: readonly GpuProvider[] = [
  'fal',
  'runpod',
  'replicate',
  'mekong',
] as const;

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerConfig {
  /** Consecutive failures required to trip circuit from CLOSED to OPEN (default: 3) */
  failureThreshold: number;
  /** Consecutive successes in HALF_OPEN required to close the circuit (default: 2) */
  successThreshold: number;
  /** Time in milliseconds to remain OPEN before probing via HALF_OPEN (default: 30000ms = 30s) */
  cooldownPeriodMs: number;
  /** Per-provider execution timeout in milliseconds (default: 120000ms = 2m) */
  executionTimeoutMs?: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  successThreshold: 2,
  cooldownPeriodMs: 30_000,
  executionTimeoutMs: 120_000,
};

/**
 * State record for an individual provider's circuit breaker
 */
interface ProviderState {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  cooldownUntil?: number;
  lastLatencyMs?: number;
}

/**
 * Registry managing circuit breaker states across all GPU providers
 */
export class CircuitBreakerRegistry {
  private readonly config: CircuitBreakerConfig;
  private readonly states: Map<GpuProvider, ProviderState> = new Map();

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.resetAll();
  }

  /**
   * Reset all providers to clean CLOSED state
   */
  public resetAll(): void {
    for (const provider of ALL_GPU_PROVIDERS) {
      this.resetProvider(provider);
    }
  }

  /**
   * Reset a specific provider to CLOSED state
   */
  public resetProvider(provider: GpuProvider): void {
    this.states.set(provider, {
      state: 'CLOSED',
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    });
  }

  /**
   * Get internal state object for provider
   */
  private getState(provider: GpuProvider): ProviderState {
    let state = this.states.get(provider);
    if (!state) {
      state = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
      };
      this.states.set(provider, state);
    }
    return state;
  }

  /**
   * Check if a request can be attempted through the specified provider
   */
  public canAttempt(provider: GpuProvider, now = Date.now()): boolean {
    const s = this.getState(provider);

    if (s.state === 'CLOSED') {
      return true;
    }

    if (s.state === 'OPEN') {
      // Check if cooldown timeout has expired
      if (s.cooldownUntil && now >= s.cooldownUntil) {
        // Transition to HALF_OPEN for probing
        s.state = 'HALF_OPEN';
        s.consecutiveSuccesses = 0;
        logger.info(`[gpu-mesh-circuit] Provider ${provider} OPEN cooldown expired -> transitioning to HALF_OPEN`);
        return true;
      }
      return false; // Still cooling down
    }

    if (s.state === 'HALF_OPEN') {
      // Allow probe attempt
      return true;
    }

    return false;
  }

  /**
   * Record a successful execution
   */
  public recordSuccess(provider: GpuProvider, latencyMs?: number, now = Date.now()): void {
    const s = this.getState(provider);
    s.lastSuccessTime = now;
    s.consecutiveFailures = 0;
    if (latencyMs !== undefined) {
      s.lastLatencyMs = latencyMs;
    }

    if (s.state === 'HALF_OPEN') {
      s.consecutiveSuccesses++;
      if (s.consecutiveSuccesses >= this.config.successThreshold) {
        s.state = 'CLOSED';
        s.cooldownUntil = undefined;
        logger.info(
          `[gpu-mesh-circuit] Provider ${provider} achieved ${s.consecutiveSuccesses} successes -> circuit reset to CLOSED`,
        );
      }
    }
  }

  /**
   * Record a failed execution
   */
  public recordFailure(provider: GpuProvider, error: unknown, now = Date.now()): void {
    const s = this.getState(provider);
    s.lastFailureTime = now;
    s.consecutiveFailures++;

    if (s.state === 'HALF_OPEN') {
      // Probe failed — immediately trip back to OPEN
      s.state = 'OPEN';
      s.consecutiveSuccesses = 0;
      s.cooldownUntil = now + this.config.cooldownPeriodMs;
      logger.warn(
        `[gpu-mesh-circuit] Provider ${provider} probe failed in HALF_OPEN -> tripped to OPEN until ${new Date(s.cooldownUntil).toISOString()}`,
        { error: String(error) },
      );
      return;
    }

    if (s.state === 'CLOSED') {
      if (s.consecutiveFailures >= this.config.failureThreshold) {
        s.state = 'OPEN';
        s.cooldownUntil = now + this.config.cooldownPeriodMs;
        logger.warn(
          `[gpu-mesh-circuit] Provider ${provider} reached ${s.consecutiveFailures} consecutive failures -> TRIPPED to OPEN until ${new Date(s.cooldownUntil).toISOString()}`,
          { error: String(error) },
        );
      }
    }
  }

  /**
   * Get public health status for a provider
   */
  public getProviderStatus(provider: GpuProvider, now = Date.now()): ProviderHealthStatus {
    const s = this.getState(provider);

    // Re-evaluate if cooldown expired while querying
    let effectiveState = s.state;
    if (s.state === 'OPEN' && s.cooldownUntil && now >= s.cooldownUntil) {
      effectiveState = 'HALF_OPEN';
    }

    return {
      provider,
      healthy: effectiveState === 'CLOSED' || effectiveState === 'HALF_OPEN',
      circuitState: effectiveState,
      consecutiveFailures: s.consecutiveFailures,
      consecutiveSuccesses: s.consecutiveSuccesses,
      lastFailureTime: s.lastFailureTime,
      lastSuccessTime: s.lastSuccessTime,
      cooldownUntil: s.cooldownUntil,
      latencyMs: s.lastLatencyMs,
    };
  }

  /**
   * Get health statuses for all known providers
   */
  public getAllProviderStatuses(now = Date.now()): Record<GpuProvider, ProviderHealthStatus> {
    const result = {} as Record<GpuProvider, ProviderHealthStatus>;
    for (const p of ALL_GPU_PROVIDERS) {
      result[p] = this.getProviderStatus(p, now);
    }
    return result;
  }
}

/**
 * Global singleton registry for application lifecycle
 */
export const globalGpuCircuitBreaker = new CircuitBreakerRegistry();

/**
 * Result details for a single provider execution attempt
 */
export interface ProviderAttemptRecord {
  provider: GpuProvider;
  status: 'success' | 'failed' | 'skipped_circuit_open';
  error?: string;
  durationMs: number;
}

/**
 * Full execution result returned by mesh failover
 */
export interface MeshExecutionResult<T> {
  result: T;
  provider: GpuProvider;
  attempts: ProviderAttemptRecord[];
  totalDurationMs: number;
}

/**
 * Error thrown when all providers in the mesh chain fail or are unavailable
 */
export class AllProvidersFailedError extends Error {
  public readonly attempts: ProviderAttemptRecord[];
  public readonly jobId: string;

  constructor(jobId: string, attempts: ProviderAttemptRecord[]) {
    const summary = attempts
      .map((a) => `${a.provider}: ${a.status}${a.error ? ` (${a.error})` : ''}`)
      .join('; ');
    super(`All GPU providers in mesh failed for job ${jobId}. Summary: [${summary}]`);
    this.name = 'AllProvidersFailedError';
    this.jobId = jobId;
    this.attempts = attempts;
  }
}

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
  const baseOrder = preferredProviderOrder && preferredProviderOrder.length > 0
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
