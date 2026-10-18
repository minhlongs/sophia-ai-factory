/**
 * Circuit breaker registry tracking provider states, cooldowns, and health probes.
 *
 * @module tree/queue/failover/heartbeat-monitor
 */

import type {
  GpuProvider,
  ProviderHealthStatus,
} from '@/seed/types/video-render-queue';
import { ALL_GPU_PROVIDERS } from '@/seed/types/video-render-queue';
import {
  type CircuitBreakerConfig,
  type ProviderState,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './types';
import {
  applyFailureTransition,
  applySuccessTransition,
  buildProviderHealthStatus,
  evaluateCanAttempt,
} from './circuit-state-transitions';

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

  public resetAll(): void {
    for (const provider of ALL_GPU_PROVIDERS) {
      this.resetProvider(provider);
    }
  }

  public resetProvider(provider: GpuProvider): void {
    this.states.set(provider, {
      state: 'CLOSED',
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    });
  }

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

  public canAttempt(provider: GpuProvider, now = Date.now()): boolean {
    return evaluateCanAttempt(provider, this.getState(provider), now);
  }

  public recordSuccess(provider: GpuProvider, latencyMs?: number, now = Date.now()): void {
    applySuccessTransition(provider, this.getState(provider), this.config, latencyMs, now);
  }

  public recordFailure(provider: GpuProvider, error: unknown, now = Date.now()): void {
    applyFailureTransition(provider, this.getState(provider), this.config, error, now);
  }

  public getProviderStatus(provider: GpuProvider, now = Date.now()): ProviderHealthStatus {
    return buildProviderHealthStatus(provider, this.getState(provider), now);
  }

  public getAllProviderStatuses(now = Date.now()): Record<GpuProvider, ProviderHealthStatus> {
    const result = {} as Record<GpuProvider, ProviderHealthStatus>;
    for (const p of ALL_GPU_PROVIDERS) {
      result[p] = this.getProviderStatus(p, now);
    }
    return result;
  }
}

export const globalGpuCircuitBreaker = new CircuitBreakerRegistry();
