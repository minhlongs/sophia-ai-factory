import { CircuitState, FailureKind } from '@/seed/types/failure-kind';
import {
  getCooldownMs,
  shouldImmediateOpen,
  type CircuitBreakerEntry,
} from '@/seed/config/circuit-breaker';
import { logger } from '@/seed/utils/logger-utility';
import { breakerKey } from './types';
import {
  memoryCache,
  thresholds,
  createEntry,
  evictIfNeeded,
  persistToD1,
} from './circuit-state-store';
import { handleConnectionFailures } from './probe-controller';

export {
  recordSuccess,
  shouldAllowRequest,
  getState,
  reset,
  __testSetEntry,
  __testOverrideThresholds,
} from './circuit-breaker-ops';

export function recordFailure(
  service: string,
  kind: FailureKind,
  keyRef?: string,
): CircuitBreakerEntry {
  const cacheKey = breakerKey(service, keyRef);
  const now = Date.now();
  const entry = memoryCache.get(cacheKey) ?? createEntry(cacheKey);

  handleConnectionFailures(entry, kind, cacheKey, now);

  if (entry.state === CircuitState.HALF_OPEN) {
    entry.state = CircuitState.OPEN;
    entry.cooldownUntil = now + getCooldownMs(kind);
    entry.failureCount++;
    entry.lastFailureAt = now;
    entry.lastAccessAt = now;
    memoryCache.set(cacheKey, entry);
    evictIfNeeded();
    logger.warn(`[CircuitBreaker] ${cacheKey} probe failed in HALF_OPEN, re-opening`, {
      service: cacheKey,
      kind,
    });
    persistToD1(entry, cacheKey).catch((err) => {
      logger.error('[CircuitBreaker] D1 persist failed', { service: cacheKey, error: String(err) });
    });
    return entry;
  }

  if (
    entry.lastFailureAt &&
    now - entry.lastFailureAt > thresholds.failureWindowMs
  ) {
    entry.failureCount = 0;
    if (entry.state !== CircuitState.CLOSED) {
      entry.state = CircuitState.CLOSED;
      entry.cooldownUntil = null;
    }
  }

  entry.failureCount++;
  entry.lastFailureAt = now;
  entry.lastAccessAt = now;

  if (shouldImmediateOpen(kind)) {
    entry.state = CircuitState.OPEN;
    entry.cooldownUntil = now + 300_000;
  } else if (entry.failureCount >= thresholds.openThreshold) {
    entry.state = CircuitState.OPEN;
    entry.cooldownUntil = now + getCooldownMs(kind);
  } else if (entry.failureCount >= thresholds.degradedThreshold) {
    entry.state = CircuitState.DEGRADED;
    entry.cooldownUntil = now + getCooldownMs(kind);
  }

  memoryCache.set(cacheKey, entry);
  evictIfNeeded();

  logger.warn(`[CircuitBreaker] ${cacheKey} failure recorded`, {
    service: cacheKey,
    kind,
    failureCount: entry.failureCount,
    state: entry.state,
  });

  persistToD1(entry, cacheKey).catch((err) => {
    logger.error('[CircuitBreaker] D1 persist failed', { service: cacheKey, error: String(err) });
  });

  return entry;
}
