import { CircuitState, FailureKind } from '@/seed/types/failure-kind';
import {
  getCooldownMs,
  shouldImmediateOpen,
  type CircuitBreakerEntry,
  type CircuitBreakerThresholds,
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
import {
  handleConnectionFailures,
  evaluateProbePermission,
} from './probe-controller';

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

export function recordSuccess(service: string, keyRef?: string): void {
  const cacheKey = breakerKey(service, keyRef);
  const entry = memoryCache.get(cacheKey);
  if (!entry) return;

  const prevState = entry.state;
  entry.state = CircuitState.CLOSED;
  entry.failureCount = 0;
  entry.cooldownUntil = null;
  entry.lastAccessAt = Date.now();
  entry.consecutiveConnectionFailures = 0;
  entry.lastConnectionFailureAt = null;
  entry.connectionCooldownUntil = null;

  if (prevState !== CircuitState.CLOSED) {
    logger.info(`[CircuitBreaker] ${cacheKey} recovered`, { service: cacheKey, prevState });
    persistToD1(entry, cacheKey).catch((err) => {
      logger.error('[CircuitBreaker] D1 persist failed', { service: cacheKey, error: String(err) });
    });
  }
}

export function shouldAllowRequest(service: string, keyRef?: string): boolean {
  const cacheKey = breakerKey(service, keyRef);
  const entry = memoryCache.get(cacheKey);
  if (!entry) return true;

  entry.lastAccessAt = Date.now();
  return evaluateProbePermission(entry, cacheKey, Date.now());
}

export function getState(service: string, keyRef?: string): CircuitBreakerEntry {
  const cacheKey = breakerKey(service, keyRef);
  return memoryCache.get(cacheKey) ?? createEntry(cacheKey);
}

export function reset(service: string, keyRef?: string): void {
  const cacheKey = breakerKey(service, keyRef);
  const entry = createEntry(cacheKey);
  memoryCache.set(cacheKey, entry);
  logger.info(`[CircuitBreaker] ${cacheKey} manually reset`, { service: cacheKey });
  persistToD1(entry, cacheKey).catch((err) => {
    logger.error('[CircuitBreaker] D1 persist failed', { service: cacheKey, error: String(err) });
  });
}

export function __testSetEntry(
  service: string,
  keyRef?: string,
  overrides: Partial<CircuitBreakerEntry> = {},
): void {
  const cacheKey = breakerKey(service, keyRef);
  const existing = memoryCache.get(cacheKey) ?? createEntry(cacheKey);
  Object.assign(existing, overrides);
  memoryCache.set(cacheKey, existing);
}

export function __testOverrideThresholds(overrides: Partial<CircuitBreakerThresholds>): void {
  Object.assign(thresholds, overrides);
}
