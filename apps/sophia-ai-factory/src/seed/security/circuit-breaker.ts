/**
 * Circuit Breaker — 4-State Machine with D1 Persistence
 *
 * Adapted from OmniRoute's circuitBreaker.ts pattern:
 * CLOSED → DEGRADED → OPEN → HALF_OPEN → CLOSED
 *
 * Key behaviors:
 * - AUTH_FAILURE (401/403) immediately opens circuit — no retry
 * - RATE_LIMIT triggers short cooldown (60s)
 * - SERVER_ERROR triggers long cooldown (300s)
 * - HALF_OPEN probes with single request on cooldown expiry
 * - 500-entry LRU registry with D1 persistence
 *
 * @module seed/security/circuit-breaker
 */

import { createServerClient } from '@/seed/db/client'
import {
  CircuitState,
  FailureKind,
  classifyError,
  classifyHttpStatus,
} from '@/seed/types/failure-kind'
import {
  DEFAULT_THRESHOLDS,
  getCooldownMs,
  shouldImmediateOpen,
  type CircuitBreakerEntry,
  type CircuitBreakerThresholds,
} from '@/seed/config/circuit-breaker'
import { logger } from '@/seed/utils/logger-utility'

const thresholds: CircuitBreakerThresholds = DEFAULT_THRESHOLDS

/** In-memory cache of circuit breaker state (avoids D1 read on every call) */
const memoryCache = new Map<string, CircuitBreakerEntry>()

/** Record a failure for a service */
export function recordFailure(
  service: string,
  kind: FailureKind
): CircuitBreakerEntry {
  const now = Date.now()
  const entry = memoryCache.get(service) ?? createEntry(service)
  const cooldownMs = getCooldownMs(kind)

  // C2 FIX: HALF_OPEN probe failure → immediately re-open with new cooldown
  if (entry.state === CircuitState.HALF_OPEN) {
    entry.state = CircuitState.OPEN
    entry.cooldownUntil = now + cooldownMs
    entry.failureCount++
    entry.lastFailureAt = now
    entry.lastAccessAt = now
    memoryCache.set(service, entry)
    evictIfNeeded()
    logger.warn(`[CircuitBreaker] ${service} probe failed in HALF_OPEN, re-opening`, {
      service,
      kind,
    })
    persistToD1(entry).catch((err) => {
      logger.error('[CircuitBreaker] D1 persist failed', { service, error: String(err) })
    })
    return entry
  }

  // H1 FIX: Decay failures outside the window
  if (
    entry.lastFailureAt &&
    now - entry.lastFailureAt > thresholds.failureWindowMs
  ) {
    entry.failureCount = 0
    // Reset state back to CLOSED if failures expired
    if (entry.state !== CircuitState.CLOSED) {
      entry.state = CircuitState.CLOSED
      entry.cooldownUntil = null
    }
  }

  entry.failureCount++
  entry.lastFailureAt = now
  entry.lastAccessAt = now

  // AUTH_FAILURE → immediate open (no cooldown wait)
  if (shouldImmediateOpen(kind)) {
    entry.state = CircuitState.OPEN
    entry.cooldownUntil = now + 300_000 // 5 min hard ceiling
  } else if (entry.failureCount >= thresholds.openThreshold) {
    entry.state = CircuitState.OPEN
    entry.cooldownUntil = now + cooldownMs
  } else if (entry.failureCount >= thresholds.degradedThreshold) {
    entry.state = CircuitState.DEGRADED
    entry.cooldownUntil = now + cooldownMs
  }

  memoryCache.set(service, entry)
  evictIfNeeded()

  logger.warn(`[CircuitBreaker] ${service} failure recorded`, {
    service,
    kind,
    failureCount: entry.failureCount,
    state: entry.state,
  })

  // Persist to D1 asynchronously (don't block caller)
  persistToD1(entry).catch((err) => {
    logger.error('[CircuitBreaker] D1 persist failed', { service, error: String(err) })
  })

  return entry
}

/** Record a success for a service — resets to CLOSED */
export function recordSuccess(service: string): void {
  const entry = memoryCache.get(service)
  if (!entry) return

  const prevState = entry.state
  entry.state = CircuitState.CLOSED
  entry.failureCount = 0
  entry.cooldownUntil = null
  entry.lastAccessAt = Date.now()

  if (prevState !== CircuitState.CLOSED) {
    logger.info(`[CircuitBreaker] ${service} recovered`, { service, prevState })
    persistToD1(entry).catch((err) => {
      logger.error('[CircuitBreaker] D1 persist failed', { service, error: String(err) })
    })
  }
}

/** Check if a request should be allowed for a service */
export function shouldAllowRequest(service: string): boolean {
  const entry = memoryCache.get(service)
  if (!entry) return true // No record = CLOSED (allow)

  // H3 FIX: Update access time for LRU
  entry.lastAccessAt = Date.now()

  const now = Date.now()

  switch (entry.state) {
    case CircuitState.CLOSED:
      return true

    case CircuitState.DEGRADED:
      // Allow but mark as degraded (future: rate-limit internally)
      return true

    case CircuitState.OPEN:
      if (entry.cooldownUntil && now >= entry.cooldownUntil) {
        entry.state = CircuitState.HALF_OPEN
        logger.info(`[CircuitBreaker] ${service} entering HALF_OPEN`, { service })
        return true // Allow probe request
      }
      return false

    case CircuitState.HALF_OPEN:
      // Only allow one probe — already in progress
      return false

    default:
      return true
  }
}

/** Get current state for a service */
export function getState(service: string): CircuitBreakerEntry {
  return memoryCache.get(service) ?? createEntry(service)
}

/** Manual reset — force CLOSED */
export function reset(service: string): void {
  const entry = createEntry(service)
  memoryCache.set(service, entry)
  logger.info(`[CircuitBreaker] ${service} manually reset`, { service })
  persistToD1(entry).catch((err) => {
    logger.error('[CircuitBreaker] D1 persist failed', { service, error: String(err) })
  })
}

/** Check if HTTP status should immediately open circuit */
export function isImmediateOpenStatus(status: number): boolean {
  return status === 401 || status === 403
}

/**
 * Test-only: directly manipulate entry fields for time-sensitive tests.
 * @internal — do not use in production code.
 */
export function __testSetEntry(
  service: string,
  overrides: Partial<CircuitBreakerEntry>,
): void {
  const existing = memoryCache.get(service) ?? createEntry(service)
  Object.assign(existing, overrides)
  memoryCache.set(service, existing)
}

/**
 * Test-only: override thresholds for eviction testing.
 * @internal — do not use in production code.
 */
export function __testOverrideThresholds(overrides: Partial<CircuitBreakerThresholds>): void {
  Object.assign(thresholds, overrides)
}

/** Create a new entry in CLOSED state */
function createEntry(service: string): CircuitBreakerEntry {
  return {
    service,
    state: CircuitState.CLOSED,
    failureCount: 0,
    lastFailureAt: null,
    cooldownUntil: null,
    lastAccessAt: Date.now(),
  }
}

/** Evict oldest entry when cache exceeds max */
function evictIfNeeded(): void {
  if (memoryCache.size <= thresholds.maxServices) return

  let oldestKey = ''
  let oldestAccess = Infinity

  for (const [key, entry] of memoryCache) {
    if (entry.lastAccessAt < oldestAccess) {
      oldestAccess = entry.lastAccessAt
      oldestKey = key
    }
  }

  if (oldestKey) {
    memoryCache.delete(oldestKey)
    logger.debug('[CircuitBreaker] Evicted oldest entry', { service: oldestKey })
  }
}

/** Persist circuit breaker state to D1 */
async function persistToD1(entry: CircuitBreakerEntry): Promise<void> {
  const db = createServerClient()

  await db
    .prepare(
      `INSERT INTO circuit_breaker_state (service, state, failure_count, last_failure_at, cooldown_until, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
       ON CONFLICT(service) DO UPDATE SET
         state = excluded.state,
         failure_count = excluded.failure_count,
         last_failure_at = excluded.last_failure_at,
         cooldown_until = excluded.cooldown_until,
         updated_at = datetime('now')`
    )
    .bind(
      entry.service,
      entry.state,
      entry.failureCount,
      entry.lastFailureAt ? new Date(entry.lastFailureAt).toISOString() : null,
      entry.cooldownUntil ? new Date(entry.cooldownUntil).toISOString() : null
    )
    .run()
}

/** Load circuit breaker state from D1 into memory cache */
export async function loadFromD1(service: string): Promise<CircuitBreakerEntry | null> {
  const db = createServerClient()
  const result = await db
    .prepare('SELECT * FROM circuit_breaker_state WHERE service = ?1')
    .bind(service)
    .first<{
      service: string
      state: string
      failure_count: number
      last_failure_at: string | null
      cooldown_until: string | null
    }>()

  if (!result) return null

  const now = Date.now()
  const cooldownUntil = result.cooldown_until
    ? new Date(result.cooldown_until).getTime()
    : null

  // If cooldown expired, transition to HALF_OPEN
  let state = result.state as CircuitState
  if (state === CircuitState.OPEN && cooldownUntil && now >= cooldownUntil) {
    state = CircuitState.HALF_OPEN
  }

  const entry: CircuitBreakerEntry = {
    service: result.service,
    state,
    failureCount: result.failure_count,
    lastFailureAt: result.last_failure_at
      ? new Date(result.last_failure_at).getTime()
      : null,
    cooldownUntil,
    lastAccessAt: Date.now(),
  }

  memoryCache.set(service, entry)
  return entry
}
