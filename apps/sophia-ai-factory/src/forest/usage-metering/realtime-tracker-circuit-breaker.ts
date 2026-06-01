/**
 * Circuit breaker logic for Real-Time Usage Tracker
 * @module usage-metering/realtime-tracker-circuit-breaker
 */

import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { getKvClient } from '@/land/redis'
import { logAuditEvent } from '@/tree/audit/audit-logger'
import {
  DEFAULT_CIRCUIT_BREAKER,
} from './realtime-tracker-types'
import type {
  CircuitState, CircuitBreakerConfig, CircuitBreakerState,
} from './realtime-tracker-types'

const circuitBreakers = new Map<string, CircuitBreakerState>()

function getCircuitBreakerKey(licenseNonce: string): string {
  return `circuit:${licenseNonce}`
}

async function getCircuitState(licenseNonce: string): Promise<CircuitBreakerState> {
  const key = getCircuitBreakerKey(licenseNonce)
  const kv = getKvClient()
  if (kv) {
    try {
      const cached = await kv.get(key)
      if (cached) {
        return (typeof cached === 'string' ? JSON.parse(cached) : cached) as CircuitBreakerState
      }
    } catch (error) {
      logger.error('[Circuit Breaker] Redis read error', toError(error))
    }
  }
  return circuitBreakers.get(key) || { state: 'closed', failures: 0, lastFailureTime: 0, halfOpenRequests: 0 }
}

async function setCircuitState(
  licenseNonce: string,
  state: CircuitBreakerState,
  ttlSeconds: number = 300,
): Promise<void> {
  const key = getCircuitBreakerKey(licenseNonce)
  const kv = getKvClient()
  if (kv) {
    try {
      await kv.set(key, state, { ex: ttlSeconds })
    } catch (error) {
      logger.error('[Circuit Breaker] Redis write error', toError(error))
    }
  }
  circuitBreakers.set(key, state)
}

export async function recordCircuitFailure(
  licenseNonce: string,
  error: Error,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER,
): Promise<CircuitState> {
  const current = await getCircuitState(licenseNonce)
  const updated: CircuitBreakerState = {
    state: current.state === 'open' ? 'open' :
      current.failures + 1 >= config.failureThreshold ? 'open' : 'closed',
    failures: current.state === 'open' ? current.failures : current.failures + 1,
    lastFailureTime: Date.now(),
    halfOpenRequests: 0,
  }
  await setCircuitState(licenseNonce, updated)
  await logAuditEvent({
    action: 'circuit_breaker_failure',
    userId: 'system',
    metadata: {
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      state: updated.state, failures: updated.failures, error: error.message,
    },
  })
  logger.warn('[Circuit Breaker] Failure recorded', {
    licenseNonce: licenseNonce.slice(0, 8) + '...', state: updated.state, failures: updated.failures,
  })
  return updated.state
}

export async function recordCircuitSuccess(
  licenseNonce: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER,
): Promise<CircuitState> {
  const current = await getCircuitState(licenseNonce)
  const now = Date.now()
  if (current.state === 'half-open') {
    if (now - current.lastFailureTime >= config.resetTimeoutMs) {
      const updated: CircuitBreakerState = { state: 'closed', failures: 0, lastFailureTime: 0, halfOpenRequests: 0 }
      await setCircuitState(licenseNonce, updated)
      logger.info('[Circuit Breaker] Reset to closed', { licenseNonce: licenseNonce.slice(0, 8) + '...' })
      return updated.state
    }
    const updated: CircuitBreakerState = { ...current, halfOpenRequests: current.halfOpenRequests + 1 }
    if (updated.halfOpenRequests >= config.halfOpenMaxRequests) {
      updated.state = 'closed'; updated.failures = 0
    }
    await setCircuitState(licenseNonce, updated)
    return updated.state
  }
  if (current.state === 'closed') {
    const updated: CircuitBreakerState = { ...current, failures: Math.max(0, current.failures - 1) }
    await setCircuitState(licenseNonce, updated)
    return updated.state
  }
  return current.state
}

export async function canPassCircuitBreaker(
  licenseNonce: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER,
): Promise<{ allowed: boolean; state: CircuitState; reason?: string }> {
  const current = await getCircuitState(licenseNonce)
  const now = Date.now()
  if (current.state === 'closed') return { allowed: true, state: 'closed' }
  if (current.state === 'open') {
    const elapsed = now - current.lastFailureTime
    if (elapsed >= config.resetTimeoutMs) {
      await setCircuitState(licenseNonce, { ...current, state: 'half-open', halfOpenRequests: 1 })
      logger.info('[Circuit Breaker] Transitioned to half-open', { licenseNonce: licenseNonce.slice(0, 8) + '...' })
      return { allowed: true, state: 'half-open', reason: 'half-open-test' }
    }
    return {
      allowed: false, state: 'open',
      reason: `circuit-open-retry-after-${Math.ceil((config.resetTimeoutMs - elapsed) / 1000)}s`,
    }
  }
  if (current.state === 'half-open') {
    if (current.halfOpenRequests < config.halfOpenMaxRequests) {
      return { allowed: true, state: 'half-open', reason: `half-open-request-${current.halfOpenRequests + 1}` }
    }
    return { allowed: false, state: 'half-open', reason: 'half-open-limit-reached' }
  }
  return { allowed: false, state: 'closed', reason: 'unknown-state' }
}
