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
 * - NETWORK failures trigger separate connection cooldown (3 consecutive = 60s lockout)
 * - HALF_OPEN probes with single request on cooldown expiry
 * - PER-KEY isolation: composite (service, keyRef) PK so one tenant's bad key
 *   does not trip the breaker for every other tenant on the same provider.
 * - 500-entry LRU registry with D1 persistence.
 *
 * @module seed/security/circuit-breaker
 */

import { createServerClient } from '@/seed/db/client'
import {
  CircuitState,
  FailureKind,
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

// ─── Per-key lockout defaults ────────────────────────────────────────────────
/** Default lockout duration (ms) injected into D1 when no per-key override exists */
const DEFAULT_LOCKOUT_MS = 0 // 0 = use standard per-kind cooldown only

/** Minimum connection failures before triggering connection cooldown */
const CONNECTION_FAILURE_THRESHOLD = 3

/** Connection cooldown duration (ms) after N consecutive NETWORK failures */
const CONNECTION_COOLDOWN_MS = 60_000

/** Build the internal cache key from provider + optional tenant key ref */
function breakerKey(service: string, keyRef = 'platform'): string {
  return `${service}:${keyRef}`
}

/** Split cache key back into [service, keyRef] for composite D1 PK */
function splitCacheKey(cacheKey: string): [string, string] {
  const idx = cacheKey.indexOf(':')
  if (idx === -1) return [cacheKey, 'platform']
  return [cacheKey.slice(0, idx), cacheKey.slice(idx + 1) || 'platform']
}

/**
 * Record a failure for a service.
 * @param keyRef - per-tenant key identity; defaults to 'platform' for shared fallback keys.
 *   BYOK callers MUST pass a tenant-scoped ref so one tenant's bad key doesn't
 *   trip the breaker for every other tenant on the same provider.
 */
export function recordFailure(
  service: string,
  kind: FailureKind,
  keyRef?: string
): CircuitBreakerEntry {
  const cacheKey = breakerKey(service, keyRef)
  const now = Date.now()
  const entry = memoryCache.get(cacheKey) ?? createEntry(cacheKey)

  // ── Connection cooldown for NETWORK failures ─────────────────────────────
  if (kind === FailureKind.NETWORK) {
    entry.consecutiveConnectionFailures = (entry.consecutiveConnectionFailures ?? 0) + 1
    entry.lastConnectionFailureAt = now
    if ((entry.consecutiveConnectionFailures ?? 0) >= CONNECTION_FAILURE_THRESHOLD) {
      entry.connectionCooldownUntil = now + CONNECTION_COOLDOWN_MS
      logger.warn(`[CircuitBreaker] ${cacheKey} connection cooldown activated (${entry.consecutiveConnectionFailures} failures)`, {
        service: cacheKey,
        kind,
      })
    }
  } else {
    // Decay connection counter on non-NETWORK success/failure
    if (entry.consecutiveConnectionFailures && entry.consecutiveConnectionFailures > 0) {
      entry.consecutiveConnectionFailures = Math.max(0, entry.consecutiveConnectionFailures - 1)
    }
    if (entry.connectionCooldownUntil && now >= entry.connectionCooldownUntil) {
      entry.connectionCooldownUntil = null
      entry.consecutiveConnectionFailures = 0
    }
  }

  // C2 FIX: HALF_OPEN probe failure → immediately re-open with new cooldown
  if (entry.state === CircuitState.HALF_OPEN) {
    entry.state = CircuitState.OPEN
    entry.cooldownUntil = now + getCooldownMs(kind)
    entry.failureCount++
    entry.lastFailureAt = now
    entry.lastAccessAt = now
    memoryCache.set(cacheKey, entry)
    evictIfNeeded()
    logger.warn(`[CircuitBreaker] ${cacheKey} probe failed in HALF_OPEN, re-opening`, {
      service: cacheKey,
      kind,
    })
    persistToD1(entry, cacheKey).catch((err) => {
      logger.error('[CircuitBreaker] D1 persist failed', { service: cacheKey, error: String(err) })
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
    entry.cooldownUntil = now + getCooldownMs(kind)
  } else if (entry.failureCount >= thresholds.degradedThreshold) {
    entry.state = CircuitState.DEGRADED
    entry.cooldownUntil = now + getCooldownMs(kind)
  }

  memoryCache.set(cacheKey, entry)
  evictIfNeeded()

  logger.warn(`[CircuitBreaker] ${cacheKey} failure recorded`, {
    service: cacheKey,
    kind,
    failureCount: entry.failureCount,
    state: entry.state,
  })

  // Persist to D1 asynchronously (don't block caller)
  persistToD1(entry, cacheKey).catch((err) => {
    logger.error('[CircuitBreaker] D1 persist failed', { service: cacheKey, error: String(err) })
  })

  return entry
}

/** Record a success for a service — resets to CLOSED */
export function recordSuccess(service: string, keyRef?: string): void {
  const cacheKey = breakerKey(service, keyRef)
  const entry = memoryCache.get(cacheKey)
  if (!entry) return

  const prevState = entry.state
  entry.state = CircuitState.CLOSED
  entry.failureCount = 0
  entry.cooldownUntil = null
  entry.lastAccessAt = Date.now()
  // Reset connection cooldown on success
  entry.consecutiveConnectionFailures = 0
  entry.lastConnectionFailureAt = null
  entry.connectionCooldownUntil = null

  if (prevState !== CircuitState.CLOSED) {
    logger.info(`[CircuitBreaker] ${cacheKey} recovered`, { service: cacheKey, prevState })
    persistToD1(entry, cacheKey).catch((err) => {
      logger.error('[CircuitBreaker] D1 persist failed', { service: cacheKey, error: String(err) })
    })
  }
}

/** Check if a request should be allowed for a service */
export function shouldAllowRequest(service: string, keyRef?: string): boolean {
  const cacheKey = breakerKey(service, keyRef)
  const entry = memoryCache.get(cacheKey)
  if (!entry) return true // No record = CLOSED (allow)

  // H3 FIX: Update access time for LRU
  entry.lastAccessAt = Date.now()

  const now = Date.now()

  // Connection cooldown gate: rejects even before state-based check
  if (
    entry.connectionCooldownUntil &&
    now < entry.connectionCooldownUntil &&
    (entry.consecutiveConnectionFailures ?? 0) >= CONNECTION_FAILURE_THRESHOLD
  ) {
    return false
  }

  switch (entry.state) {
    case CircuitState.CLOSED:
      return true

    case CircuitState.DEGRADED:
      // Allow but mark as degraded (future: rate-limit internally)
      return true

    case CircuitState.OPEN:
      if (entry.cooldownUntil && now >= entry.cooldownUntil) {
        entry.state = CircuitState.HALF_OPEN
        logger.info(`[CircuitBreaker] ${cacheKey} entering HALF_OPEN`, { service: cacheKey })
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
export function getState(service: string, keyRef?: string): CircuitBreakerEntry {
  const cacheKey = breakerKey(service, keyRef)
  return memoryCache.get(cacheKey) ?? createEntry(cacheKey)
}

/** Manual reset — force CLOSED */
export function reset(service: string, keyRef?: string): void {
  const cacheKey = breakerKey(service, keyRef)
  const entry = createEntry(cacheKey)
  memoryCache.set(cacheKey, entry)
  logger.info(`[CircuitBreaker] ${cacheKey} manually reset`, { service: cacheKey })
  persistToD1(entry, cacheKey).catch((err) => {
    logger.error('[CircuitBreaker] D1 persist failed', { service: cacheKey, error: String(err) })
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
  keyRef?: string,
  overrides: Partial<CircuitBreakerEntry> = {},
): void {
  const cacheKey = breakerKey(service, keyRef)
  const existing = memoryCache.get(cacheKey) ?? createEntry(cacheKey)
  Object.assign(existing, overrides)
  memoryCache.set(cacheKey, existing)
}

/**
 * Test-only: override thresholds for eviction testing.
 * @internal — do not use in production code.
 */
export function __testOverrideThresholds(overrides: Partial<CircuitBreakerThresholds>): void {
  Object.assign(thresholds, overrides)
}

/** Create a new entry in CLOSED state */
function createEntry(cacheKey: string): CircuitBreakerEntry {
  const [service] = splitCacheKey(cacheKey)
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

/** Persist circuit breaker state to D1 using composite PK (service, key_ref) */
async function persistToD1(entry: CircuitBreakerEntry, cacheKey: string): Promise<void> {
  const db = createServerClient()
  const [service, keyRef] = splitCacheKey(cacheKey)

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
    .run()

  // Best-effort waitUntil: extend the request lifetime so the D1 write completes
  // even after the response is sent. Falls back to fire-and-forget if no context.
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const ctx = await getCloudflareContext()
    if ('waitUntil' in ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(writePromise)
    }
  } catch {
    // Not in a CF request context (local dev, test, cron) — await directly
    await writePromise
  }
}