/**
 * Circuit Breaker State Transitions & Health Snapshot Builder
 *
 * @module tree/queue/failover/circuit-state-transitions
 */

import type {
  GpuProvider,
  ProviderHealthStatus,
} from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';
import type { CircuitBreakerConfig, ProviderState } from './types';

export function evaluateCanAttempt(
  provider: GpuProvider,
  s: ProviderState,
  now: number,
): boolean {
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

  return s.state === 'HALF_OPEN';
}

export function applySuccessTransition(
  provider: GpuProvider,
  s: ProviderState,
  config: CircuitBreakerConfig,
  latencyMs: number | undefined,
  now: number,
): void {
  s.lastSuccessTime = now;
  s.consecutiveFailures = 0;
  if (latencyMs !== undefined) {
    s.lastLatencyMs = latencyMs;
  }

  if (s.state === 'HALF_OPEN') {
    s.consecutiveSuccesses++;
    if (s.consecutiveSuccesses >= config.successThreshold) {
      s.state = 'CLOSED';
      s.cooldownUntil = undefined;
      logger.info(
        `[gpu-mesh-circuit] Provider ${provider} achieved ${s.consecutiveSuccesses} successes -> circuit reset to CLOSED`,
      );
    }
  }
}

export function applyFailureTransition(
  provider: GpuProvider,
  s: ProviderState,
  config: CircuitBreakerConfig,
  error: unknown,
  now: number,
): void {
  s.lastFailureTime = now;
  s.consecutiveFailures++;

  if (s.state === 'HALF_OPEN') {
    s.state = 'OPEN';
    s.consecutiveSuccesses = 0;
    s.cooldownUntil = now + config.cooldownPeriodMs;
    logger.warn(
      `[gpu-mesh-circuit] Provider ${provider} probe failed in HALF_OPEN -> tripped to OPEN until ${new Date(s.cooldownUntil).toISOString()}`,
      { error: String(error) },
    );
    return;
  }

  if (s.state === 'CLOSED' && s.consecutiveFailures >= config.failureThreshold) {
    s.state = 'OPEN';
    s.cooldownUntil = now + config.cooldownPeriodMs;
    logger.warn(
      `[gpu-mesh-circuit] Provider ${provider} reached ${s.consecutiveFailures} consecutive failures -> TRIPPED to OPEN until ${new Date(s.cooldownUntil).toISOString()}`,
      { error: String(error) },
    );
  }
}

export function buildProviderHealthStatus(
  provider: GpuProvider,
  s: ProviderState,
  now: number,
): ProviderHealthStatus {
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
