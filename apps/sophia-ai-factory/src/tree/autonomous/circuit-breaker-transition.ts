/**
 * Circuit Breaker Input Normalization & Transition Helpers
 *
 * Layer: tree/autonomous
 * @module tree/autonomous/circuit-breaker-transition
 */

import type {
  CircuitBreakerStatus,
  CircuitState,
  CircuitStatus,
} from '@/seed/types/autonomous-engine';
import {
  DEFAULT_CIRCUIT_CONFIG,
  type CircuitEvaluationInput,
} from './circuit-breaker-status';

export interface NormalizedCircuitFields {
  currentState: CircuitState;
  cooldown: number;
  failureThreshold: number;
  initialFailures: number;
  initialLastFailureAt: number | null;
  initialLastStateChangeAt: number;
  serviceOrSkill: string;
}

export function normalizeCircuitInput(
  current: CircuitEvaluationInput,
  now: number,
): NormalizedCircuitFields {
  const rawStatus = (current as { status?: CircuitStatus | CircuitBreakerStatus }).status;
  const statusObj = typeof rawStatus === 'object' && rawStatus !== null ? rawStatus : null;

  const currentState: CircuitState =
    statusObj?.state ??
    (typeof rawStatus === 'string' ? rawStatus : undefined) ??
    (current as { state?: CircuitState }).state ??
    'CLOSED';

  const cooldown =
    statusObj?.cooldownPeriodMs ??
    (current as { cooldownMs?: number }).cooldownMs ??
    (current as { cooldownPeriodMs?: number }).cooldownPeriodMs ??
    DEFAULT_CIRCUIT_CONFIG.cooldownPeriodMs;

  const failureThreshold =
    statusObj?.failureThreshold ??
    (current as { failureThreshold?: number }).failureThreshold ??
    DEFAULT_CIRCUIT_CONFIG.failureThreshold;

  const serviceOrSkill =
    (current as { serviceOrSkill?: string }).serviceOrSkill ??
    (current as { service?: string }).service ??
    'default';

  return {
    currentState,
    cooldown,
    failureThreshold,
    initialFailures: statusObj?.consecutiveFailures ?? current.consecutiveFailures ?? 0,
    initialLastFailureAt: statusObj?.lastFailureAt ?? current.lastFailureAt ?? null,
    initialLastStateChangeAt: statusObj?.lastStateChangeAt ?? current.lastStateChangeAt ?? now,
    serviceOrSkill,
  };
}
