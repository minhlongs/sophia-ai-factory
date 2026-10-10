import { createServerClient } from '@/seed/db/client';
import { CircuitState } from '@/seed/types/failure-kind';
import {
  DEFAULT_THRESHOLDS,
  type CircuitBreakerEntry,
  type CircuitBreakerThresholds,
} from '@/seed/config/circuit-breaker';
import { logger } from '@/seed/utils/logger-utility';
import { DEFAULT_LOCKOUT_MS, splitCacheKey } from './types';

export const thresholds: CircuitBreakerThresholds = { ...DEFAULT_THRESHOLDS };
export const memoryCache = new Map<string, CircuitBreakerEntry>();

export function createEntry(cacheKey: string): CircuitBreakerEntry {
  const [service] = splitCacheKey(cacheKey);
  return {
    service,
    state: CircuitState.CLOSED,
    failureCount: 0,
    lastFailureAt: null,
    cooldownUntil: null,
    lastAccessAt: Date.now(),
    lockoutSeconds: DEFAULT_LOCKOUT_MS,
    consecutiveConnectionFailures: 0,
    lastConnectionFailureAt: null,
    connectionCooldownUntil: null,
  };
}

export function evictIfNeeded(): void {
  if (memoryCache.size <= thresholds.maxServices) return;

  let oldestKey = '';
  let oldestAccess = Infinity;

  for (const [key, entry] of memoryCache) {
    if (entry.lastAccessAt < oldestAccess) {
      oldestAccess = entry.lastAccessAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    memoryCache.delete(oldestKey);
    logger.debug('[CircuitBreaker] Evicted oldest entry', { service: oldestKey });
  }
}

export async function persistToD1(entry: CircuitBreakerEntry, cacheKey: string): Promise<void> {
  const db = createServerClient();
  const [service, keyRef] = splitCacheKey(cacheKey);

  const writePromise = db
    .prepare(
      `INSERT INTO circuit_breaker_state (service, key_ref, state, failure_count, last_failure_at, cooldown_until, lockout_seconds, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
       ON CONFLICT(service, key_ref) DO UPDATE SET
         state = excluded.state,
         failure_count = excluded.failure_count,
         last_failure_at = excluded.last_failure_at,
         cooldown_until = excluded.cooldown_until,
         lockout_seconds = excluded.lockout_seconds,
         updated_at = datetime('now')`
    )
    .bind(
      service,
      keyRef,
      entry.state,
      entry.failureCount,
      entry.lastFailureAt ? new Date(entry.lastFailureAt).toISOString() : null,
      entry.cooldownUntil ? new Date(entry.cooldownUntil).toISOString() : null,
      entry.lockoutSeconds ?? DEFAULT_LOCKOUT_MS,
    )
    .run();

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if ('waitUntil' in ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(writePromise);
    }
  } catch {
    await writePromise;
  }
}
