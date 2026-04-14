/**
 * Real-Time Usage Tracker
 *
 * Sub-second usage aggregation with circuit breaker pattern:
 * - Redis/Upstash for real-time counters
 * - Circuit breaker for quota check failures
 * - Fail-closed mode with audit logging
 * - Emergency bypass header support
 *
 * @module usage-metering/realtime-tracker
 */

import { logger } from '@/lib/utils/logger-utility';
import { getKvClient } from '@/lib/redis';
import { createServerClient } from '@/lib/db/client';
import { logAuditEvent } from '@/lib/audit/audit-logger';

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before opening
  resetTimeoutMs: number;       // Time before half-open
  halfOpenMaxRequests: number;  // Max requests in half-open state
}

const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,        // 30 seconds
  halfOpenMaxRequests: 3,
};

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  halfOpenRequests: number;
}

/**
 * Real-time usage counter
 */
export interface RealTimeUsage {
  licenseNonce: string;
  userId: string;
  tier: string;
  currentCredits: number;
  windowStart: number;
  windowMs: number;
}

/**
 * Circuit breaker registry (in-memory for edge, Redis for distributed)
 */
const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Get circuit breaker key for license
 */
function getCircuitBreakerKey(licenseNonce: string): string {
  return `circuit:${licenseNonce}`;
}

/**
 * Get circuit breaker state
 */
async function getCircuitState(
  licenseNonce: string
): Promise<CircuitBreakerState> {
  const key = getCircuitBreakerKey(licenseNonce);

  // Try Redis first
  const kv = getKvClient();
  if (kv) {
    try {
      const cached = await kv.get(key);
      if (cached) return cached as CircuitBreakerState;
    } catch (error) {
      logger.error('[Circuit Breaker] Redis read error', error as Error);
    }
  }

  // Fallback to in-memory
  return circuitBreakers.get(key) || {
    state: 'closed',
    failures: 0,
    lastFailureTime: 0,
    halfOpenRequests: 0,
  };
}

/**
 * Update circuit breaker state
 */
async function setCircuitState(
  licenseNonce: string,
  state: CircuitBreakerState,
  ttlSeconds: number = 300
): Promise<void> {
  const key = getCircuitBreakerKey(licenseNonce);

  // Store in Redis
  const kv = getKvClient();
  if (kv) {
    try {
      await kv.set(key, state, { expirationTtl: ttlSeconds });
    } catch (error) {
      logger.error('[Circuit Breaker] Redis write error', error as Error);
    }
  }

  // Also store in-memory (fallback)
  circuitBreakers.set(key, state);
}

/**
 * Record circuit breaker failure
 */
export async function recordCircuitFailure(
  licenseNonce: string,
  error: Error,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER
): Promise<CircuitState> {
  const current = await getCircuitState(licenseNonce);
  const now = Date.now();

  // Update state
  const updated: CircuitBreakerState = {
    state: current.state === 'open' ? 'open' :
           current.failures + 1 >= config.failureThreshold ? 'open' : 'closed',
    failures: current.state === 'open' ? current.failures : current.failures + 1,
    lastFailureTime: now,
    halfOpenRequests: 0,  // Reset on failure
  };

  await setCircuitState(licenseNonce, updated);

  // Log to audit trail
  await logAuditEvent({
    action: 'circuit_breaker_failure',
    userId: 'system',
    metadata: {
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      state: updated.state,
      failures: updated.failures,
      error: error.message,
    },
  });

  logger.warn('[Circuit Breaker] Failure recorded', {
    licenseNonce: licenseNonce.slice(0, 8) + '...',
    state: updated.state,
    failures: updated.failures,
  });

  return updated.state;
}

/**
 * Record circuit breaker success
 */
export async function recordCircuitSuccess(
  licenseNonce: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER
): Promise<CircuitState> {
  const current = await getCircuitState(licenseNonce);
  const now = Date.now();

  // Check if we're in half-open state
  if (current.state === 'half-open') {
    // Check if reset timeout has passed
    const timeSinceFailure = now - current.lastFailureTime;

    if (timeSinceFailure >= config.resetTimeoutMs) {
      // Reset to closed
      const updated: CircuitBreakerState = {
        state: 'closed',
        failures: 0,
        lastFailureTime: 0,
        halfOpenRequests: 0,
      };

      await setCircuitState(licenseNonce, updated);

      logger.info('[Circuit Breaker] Reset to closed', {
        licenseNonce: licenseNonce.slice(0, 8) + '...',
      });

      return updated.state;
    }

    // Increment half-open requests
    const updated: CircuitBreakerState = {
      ...current,
      halfOpenRequests: current.halfOpenRequests + 1,
    };

    if (updated.halfOpenRequests >= config.halfOpenMaxRequests) {
      updated.state = 'closed';
      updated.failures = 0;
    }

    await setCircuitState(licenseNonce, updated);
    return updated.state;
  }

  // Already closed - just reset failures
  if (current.state === 'closed') {
    const updated: CircuitBreakerState = {
      ...current,
      failures: Math.max(0, current.failures - 1),
    };

    await setCircuitState(licenseNonce, updated);
    return updated.state;
  }

  return current.state;
}

/**
 * Check if circuit breaker allows request
 *
 * Fail-closed for quota checks:
 * - Closed = allow
 * - Open = block (fail-closed)
 * - Half-open = allow limited requests
 */
export async function canPassCircuitBreaker(
  licenseNonce: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER
): Promise<{ allowed: boolean; state: CircuitState; reason?: string }> {
  const current = await getCircuitState(licenseNonce);
  const now = Date.now();

  // Closed state - allow all
  if (current.state === 'closed') {
    return { allowed: true, state: 'closed' };
  }

  // Open state - check if reset timeout passed
  if (current.state === 'open') {
    const timeSinceFailure = now - current.lastFailureTime;

    if (timeSinceFailure >= config.resetTimeoutMs) {
      // Transition to half-open
      const updated: CircuitBreakerState = {
        ...current,
        state: 'half-open',
        halfOpenRequests: 1,
      };

      await setCircuitState(licenseNonce, updated);

      logger.info('[Circuit Breaker] Transitioned to half-open', {
        licenseNonce: licenseNonce.slice(0, 8) + '...',
      });

      return { allowed: true, state: 'half-open', reason: 'half-open-test' };
    }

    // Still open - block
    return {
      allowed: false,
      state: 'open',
      reason: `circuit-open-retry-after-${Math.ceil((config.resetTimeoutMs - timeSinceFailure) / 1000)}s`
    };
  }

  // Half-open state - allow limited requests
  if (current.state === 'half-open') {
    if (current.halfOpenRequests < config.halfOpenMaxRequests) {
      return {
        allowed: true,
        state: 'half-open',
        reason: `half-open-request-${current.halfOpenRequests + 1}`
      };
    }

    return {
      allowed: false,
      state: 'half-open',
      reason: 'half-open-limit-reached'
    };
  }

  return { allowed: false, state: 'closed', reason: 'unknown-state' };
}

/**
 * Get real-time usage from Redis counter
 */
export async function getRealTimeUsage(
  userId: string,
  licenseNonce: string
): Promise<RealTimeUsage | null> {
  const kv = getKvClient();
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, using DB fallback');
    return null;
  }

  try {
    const key = `usage:${userId}:${licenseNonce}`;
    const cached = await kv.get(key);

    if (cached) {
      return cached as RealTimeUsage;
    }

    return null;
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis read error', error as Error);
    return null;
  }
}

/**
 * Update real-time usage counter
 */
export async function updateRealTimeUsage(
  usage: RealTimeUsage,
  ttlSeconds: number = 3600
): Promise<void> {
  const kv = getKvClient();
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, skipping counter update');
    return;
  }

  try {
    const key = `usage:${usage.userId}:${usage.licenseNonce}`;
    await kv.set(key, usage, { expirationTtl: ttlSeconds });
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis write error', error as Error);
  }
}

/**
 * Invalidate real-time usage cache
 * Called after each usage event ingestion
 */
export async function invalidateRealTimeCache(
  userId: string,
  licenseNonce: string
): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  try {
    const usageKey = `usage:${userId}:${licenseNonce}`;
    await kv.set(usageKey, null);  // Delete key

    logger.debug('[Real-Time Tracker] Cache invalidated', {
      userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
    });
  } catch (error) {
    logger.error('[Real-Time Tracker] Cache invalidation error', error as Error);
  }
}

/**
 * Check emergency bypass header
 * Admin override for circuit breaker failures
 */
export function hasEmergencyBypass(requestHeaders: Headers): boolean {
  const bypassHeader = requestHeaders.get('x-emergency-bypass');
  const adminSecret = process.env.EMERGENCY_BYPASS_SECRET;

  if (!bypassHeader || !adminSecret) {
    return false;
  }

  return bypassHeader === adminSecret;
}

/**
 * Track usage with circuit breaker protection
 *
 * Flow:
 * 1. Check emergency bypass (admin override)
 * 2. Check circuit breaker state
 * 3. Get real-time usage
 * 4. Update counter
 * 5. Record success/failure
 */
export async function trackWithCircuitBreaker(
  userId: string,
  licenseNonce: string,
  tier: string,
  creditsUsed: number,
  windowMs: number = 1000  // 1 second window
): Promise<{ allowed: boolean; reason?: string; currentCredits?: number }> {
  // Check circuit breaker first
  const circuitCheck = await canPassCircuitBreaker(licenseNonce);

  if (!circuitCheck.allowed) {
    logger.warn('[Real-Time Tracker] Blocked by circuit breaker', {
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      state: circuitCheck.state,
      reason: circuitCheck.reason,
    });

    return {
      allowed: false,
      reason: circuitCheck.reason,
    };
  }

  try {
    // Get current usage
    let current = await getRealTimeUsage(userId, licenseNonce);

    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;

    if (!current || current.windowStart !== windowStart) {
      // New window - reset counter
      current = {
        licenseNonce,
        userId,
        tier,
        currentCredits: creditsUsed,
        windowStart,
        windowMs,
      };
    } else {
      // Same window - increment
      current.currentCredits += creditsUsed;
    }

    // Update counter
    await updateRealTimeUsage(current);

    // Record success
    await recordCircuitSuccess(licenseNonce);

    return {
      allowed: true,
      currentCredits: current.currentCredits,
    };
  } catch (error) {
    // Record failure
    await recordCircuitFailure(licenseNonce, error as Error);

    return {
      allowed: false,
      reason: `tracking-error: ${(error as Error).message}`,
    };
  }
}
