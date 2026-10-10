import { CircuitState, FailureKind } from '@/seed/types/failure-kind';
import { type CircuitBreakerEntry } from '@/seed/config/circuit-breaker';
import { logger } from '@/seed/utils/logger-utility';
import { CONNECTION_FAILURE_THRESHOLD, CONNECTION_COOLDOWN_MS } from './types';

export function handleConnectionFailures(
  entry: CircuitBreakerEntry,
  kind: FailureKind,
  cacheKey: string,
  now: number,
): void {
  if (kind === FailureKind.NETWORK) {
    entry.consecutiveConnectionFailures = (entry.consecutiveConnectionFailures ?? 0) + 1;
    entry.lastConnectionFailureAt = now;
    if ((entry.consecutiveConnectionFailures ?? 0) >= CONNECTION_FAILURE_THRESHOLD) {
      entry.connectionCooldownUntil = now + CONNECTION_COOLDOWN_MS;
      logger.warn(`[CircuitBreaker] ${cacheKey} connection cooldown activated (${entry.consecutiveConnectionFailures} failures)`, {
        service: cacheKey,
        kind,
      });
    }
  } else {
    if (entry.consecutiveConnectionFailures && entry.consecutiveConnectionFailures > 0) {
      entry.consecutiveConnectionFailures = Math.max(0, entry.consecutiveConnectionFailures - 1);
    }
    if (entry.connectionCooldownUntil && now >= entry.connectionCooldownUntil) {
      entry.connectionCooldownUntil = null;
      entry.consecutiveConnectionFailures = 0;
    }
  }
}

export function evaluateProbePermission(
  entry: CircuitBreakerEntry,
  cacheKey: string,
  now: number,
): boolean {
  if (
    entry.connectionCooldownUntil &&
    now < entry.connectionCooldownUntil &&
    (entry.consecutiveConnectionFailures ?? 0) >= CONNECTION_FAILURE_THRESHOLD
  ) {
    return false;
  }

  switch (entry.state) {
    case CircuitState.CLOSED:
    case CircuitState.DEGRADED:
      return true;

    case CircuitState.OPEN:
      if (entry.cooldownUntil && now >= entry.cooldownUntil) {
        entry.state = CircuitState.HALF_OPEN;
        logger.info(`[CircuitBreaker] ${cacheKey} entering HALF_OPEN`, { service: cacheKey });
        return true;
      }
      return false;

    case CircuitState.HALF_OPEN:
      return false;

    default:
      return true;
  }
}
