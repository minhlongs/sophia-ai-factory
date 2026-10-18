import type {
  CircuitBreakerState,
  GpuMeshRegionHealth,
  RegionHealthStatus,
} from '@/seed/types/gpu-mesh';
import { GPU_MESH_CIRCUIT_BREAKER_CONFIG } from '@/seed/config/gpu-mesh';

export interface CircuitBreakerEvaluationInput {
  now: number;
  p95Latency: number;
  errorRate: number;
  current: GpuMeshRegionHealth | null;
  details: Record<string, unknown>;
}

export interface CircuitBreakerEvaluationResult {
  healthStatus: RegionHealthStatus;
  circuitBreakerState: CircuitBreakerState;
}

export function evaluateCircuitBreakerTransition(
  input: CircuitBreakerEvaluationInput,
): CircuitBreakerEvaluationResult {
  const { now, p95Latency, errorRate, current, details } = input;

  const isTripThreshold =
    errorRate >= GPU_MESH_CIRCUIT_BREAKER_CONFIG.failureRateThresholdPct ||
    p95Latency > 2500;
  const isDegradedThreshold = errorRate >= 20.0 || p95Latency > 1500;
  const isHealthy = !isTripThreshold && !isDegradedThreshold;

  let healthStatus: RegionHealthStatus = 'healthy';
  let circuitBreakerState: CircuitBreakerState = current?.circuitBreakerState ?? 'CLOSED';
  let consecutiveSuccesses =
    typeof details.consecutiveSuccesses === 'number' ? details.consecutiveSuccesses : 0;

  if (circuitBreakerState === 'OPEN') {
    const tripTime =
      typeof details.trippedAt === 'number'
        ? details.trippedAt
        : (current?.lastProbeAt ?? 0);
    const cooldownElapsed =
      now - tripTime >= GPU_MESH_CIRCUIT_BREAKER_CONFIG.cooldownPeriodSecs;

    if (!cooldownElapsed) {
      circuitBreakerState = 'OPEN';
      healthStatus = 'unhealthy';
      consecutiveSuccesses = 0;
    } else if (!isHealthy) {
      circuitBreakerState = 'OPEN';
      healthStatus = 'unhealthy';
      consecutiveSuccesses = 0;
      details.trippedAt = now;
    } else {
      circuitBreakerState = 'HALF_OPEN';
      healthStatus = 'degraded';
      consecutiveSuccesses = 1;
      delete details.trippedAt;
    }
  } else if (circuitBreakerState === 'HALF_OPEN') {
    if (!isHealthy) {
      circuitBreakerState = 'OPEN';
      healthStatus = 'unhealthy';
      consecutiveSuccesses = 0;
      details.trippedAt = now;
    } else {
      consecutiveSuccesses += 1;
      if (
        consecutiveSuccesses >=
        GPU_MESH_CIRCUIT_BREAKER_CONFIG.consecutiveSuccessesToClose
      ) {
        circuitBreakerState = 'CLOSED';
        healthStatus = 'healthy';
        consecutiveSuccesses = 0;
        delete details.trippedAt;
      } else {
        circuitBreakerState = 'HALF_OPEN';
        healthStatus = 'degraded';
      }
    }
  } else {
    if (isTripThreshold) {
      circuitBreakerState = 'OPEN';
      healthStatus = 'unhealthy';
      consecutiveSuccesses = 0;
      details.trippedAt = now;
    } else if (isDegradedThreshold) {
      circuitBreakerState = 'HALF_OPEN';
      healthStatus = 'degraded';
      consecutiveSuccesses = 0;
    } else {
      circuitBreakerState = 'CLOSED';
      healthStatus = 'healthy';
      consecutiveSuccesses = 0;
      delete details.trippedAt;
    }
  }

  details.consecutiveSuccesses = consecutiveSuccesses;
  return { healthStatus, circuitBreakerState };
}
