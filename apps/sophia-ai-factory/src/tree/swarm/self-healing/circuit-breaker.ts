/**
 * Edge Circuit Breaker State Machine & In-Memory Metrics
 *
 * @module tree/swarm/self-healing/circuit-breaker
 */

import type {
  CircuitBreakerMetrics,
  CircuitBreakerConfig,
} from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3, // Trip after 3 consecutive failures
  cooldownPeriodMs: 30_000, // 30s before testing with HALF_OPEN
  probeSuccessThreshold: 1, // 1 successful probe to reset to CLOSED
};

// In-memory circuit state cache per edge node
const nodeCircuitStates = new Map<string, CircuitBreakerMetrics>();

/**
 * Resets or clears circuit breaker state for a node (e.g. for testing).
 */
export function resetCircuit(nodeId: string): void {
  nodeCircuitStates.delete(nodeId);
}

/**
 * Clears all in-memory circuit breaker states (test isolation).
 */
export function resetAllCircuits(): void {
  nodeCircuitStates.clear();
}

/**
 * Gets or initializes the circuit breaker metrics for a node.
 * Evaluates cooldown transition from OPEN -> HALF_OPEN automatically.
 */
export function getCircuitBreakerMetrics(
  nodeId: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG,
  now: number = Date.now()
): CircuitBreakerMetrics {
  let metrics = nodeCircuitStates.get(nodeId);
  if (!metrics) {
    metrics = {
      state: 'CLOSED',
      consecutiveFailures: 0,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastFailureAt: null,
      lastStateChangeAt: now,
    };
    nodeCircuitStates.set(nodeId, metrics);
    return metrics;
  }

  // Transition OPEN -> HALF_OPEN if cooldown period has elapsed
  if (metrics.state === 'OPEN' && now - metrics.lastStateChangeAt >= config.cooldownPeriodMs) {
    metrics.state = 'HALF_OPEN';
    metrics.lastStateChangeAt = now;
    logger.info('[self-healing-arbiter] Circuit transitioned OPEN -> HALF_OPEN', { nodeId });
  }

  return metrics;
}

/**
 * Records a successful operation through a node's circuit.
 * If circuit was HALF_OPEN, transitions to CLOSED.
 */
export function recordSuccess(
  nodeId: string,
  _config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG,
  now: number = Date.now()
): CircuitBreakerMetrics {
  const metrics = getCircuitBreakerMetrics(nodeId, _config, now);
  metrics.totalCalls++;
  metrics.successfulCalls++;
  metrics.consecutiveFailures = 0;

  if (metrics.state === 'HALF_OPEN') {
    metrics.state = 'CLOSED';
    metrics.lastStateChangeAt = now;
    logger.info('[self-healing-arbiter] Circuit recovered HALF_OPEN -> CLOSED', { nodeId });
  }

  return metrics;
}

/**
 * Records a failed operation through a node's circuit.
 * Evaluates failure threshold to trip circuit into OPEN state.
 */
export function recordFailure(
  nodeId: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG,
  now: number = Date.now()
): { tripped: boolean; metrics: CircuitBreakerMetrics } {
  const metrics = getCircuitBreakerMetrics(nodeId, config, now);
  metrics.totalCalls++;
  metrics.failedCalls++;
  metrics.consecutiveFailures++;
  metrics.lastFailureAt = now;

  let tripped = false;

  if (metrics.state === 'HALF_OPEN') {
    metrics.state = 'OPEN';
    metrics.lastStateChangeAt = now;
    tripped = true;
    logger.warn('[self-healing-arbiter] Probe failed in HALF_OPEN, tripped to OPEN', { nodeId });
  } else if (metrics.state === 'CLOSED' && metrics.consecutiveFailures >= config.failureThreshold) {
    metrics.state = 'OPEN';
    metrics.lastStateChangeAt = now;
    tripped = true;
    logger.warn('[self-healing-arbiter] Failure threshold reached, tripped CLOSED -> OPEN', {
      nodeId,
      consecutiveFailures: metrics.consecutiveFailures,
    });
  }

  return { tripped, metrics };
}
