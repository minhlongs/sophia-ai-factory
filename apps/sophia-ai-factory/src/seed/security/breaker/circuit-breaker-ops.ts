import { CircuitState } from '@/seed/types/failure-kind';
import type {
  CircuitBreakerEntry,
  CircuitBreakerThresholds,
} from '@/seed/config/circuit-breaker';
import { logger } from '@/seed/utils/logger-utility';
import { breakerKey } from './types';
import {
  memoryCache,
  thresholds,
  createEntry,
  persistToD1,
} from './circuit-state-store';
import { evaluateProbePermission } from './probe-controller';

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
