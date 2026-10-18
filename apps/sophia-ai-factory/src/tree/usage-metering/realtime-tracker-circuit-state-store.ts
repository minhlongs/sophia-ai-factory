/**
 * Circuit Breaker State Store for Real-Time Usage Tracker
 * @module usage-metering/realtime-tracker-circuit-state-store
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getKvClient } from '@/seed/utils/redis-client';
import type { CircuitBreakerState } from './realtime-tracker-types';

const circuitBreakers = new Map<string, CircuitBreakerState>();

function getCircuitBreakerKey(licenseNonce: string): string {
  return `circuit:${licenseNonce}`;
}

export async function getCircuitState(licenseNonce: string): Promise<CircuitBreakerState> {
  const key = getCircuitBreakerKey(licenseNonce);
  const kv = getKvClient();
  if (kv) {
    try {
      const cached = await kv.get(key);
      if (cached) {
        return (typeof cached === 'string' ? JSON.parse(cached) : cached) as CircuitBreakerState;
      }
    } catch (error) {
      logger.error('[Circuit Breaker] Redis read error', toError(error));
    }
  }
  return circuitBreakers.get(key) || { state: 'closed', failures: 0, lastFailureTime: 0, halfOpenRequests: 0 };
}

export async function setCircuitState(
  licenseNonce: string,
  state: CircuitBreakerState,
  ttlSeconds: number = 300,
): Promise<void> {
  const key = getCircuitBreakerKey(licenseNonce);
  const kv = getKvClient();
  if (kv) {
    try {
      await kv.set(key, state, { ex: ttlSeconds });
    } catch (error) {
      logger.error('[Circuit Breaker] Redis write error', toError(error));
    }
  }
  circuitBreakers.set(key, state);
}
