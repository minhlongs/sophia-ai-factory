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
import { logger } from '@/seed/utils/logger-utility';
import {
  type CircuitBreakerConfig,
  type ProviderState,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './types';

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
    const s = this.getState(provider);

    if (s.state === 'CLOSED') {
      return true;
    }

    if (s.state === 'OPEN') {
      if (s.cooldownUntil && now >= s.cooldownUntil) {
        s.state = 'HALF_OPEN';
        s.consecutiveSuccesses = 0;
        logger.info(`[gpu-mesh-circuit] Provider ${provider} OPEN cooldown expired -> transitioning to HALF_OPEN`);
        return true;
      }
      return false;
    }

    if (s.state === 'HALF_OPEN') {
      return true;
    }

    return false;
  }

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

  public recordFailure(provider: GpuProvider, error: unknown, now = Date.now()): void {
    const s = this.getState(provider);
    s.lastFailureTime = now;
    s.consecutiveFailures++;

    if (s.state === 'HALF_OPEN') {
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

  public getProviderStatus(provider: GpuProvider, now = Date.now()): ProviderHealthStatus {
    const s = this.getState(provider);

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

  public getAllProviderStatuses(now = Date.now()): Record<GpuProvider, ProviderHealthStatus> {
    const result = {} as Record<GpuProvider, ProviderHealthStatus>;
    for (const p of ALL_GPU_PROVIDERS) {
      result[p] = this.getProviderStatus(p, now);
    }
    return result;
  }
}

export const globalGpuCircuitBreaker = new CircuitBreakerRegistry();
