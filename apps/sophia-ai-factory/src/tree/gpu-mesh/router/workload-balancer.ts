import type { D1Database } from '@/seed/db/client';
import type {
  GpuMeshRegionHealth,
  CircuitBreakerState,
  RegionHealthStatus,
} from '@/seed/types/gpu-mesh';
import { GPU_MESH_CIRCUIT_BREAKER_CONFIG } from '@/seed/config/gpu-mesh';
import type { RegionTelemetryUpdate } from './types';
import { getRegionHealth } from './region-health-checker';

/**
 * Record regional health telemetry and evaluate circuit breaker transition
 */
export async function updateRegionHealthTelemetry(
  db: D1Database,
  telemetry: RegionTelemetryUpdate,
): Promise<GpuMeshRegionHealth> {
  const now = telemetry.probeTimestamp ?? Math.floor(Date.now() / 1000);
  const current = await getRegionHealth(db, telemetry.region);

  const p95Latency = telemetry.p95LatencyMs ?? current?.p95LatencyMs ?? 200;
  const errorRate = telemetry.errorRatePct ?? current?.errorRatePct ?? 0.0;
  const activeRes = telemetry.activeReservations ?? current?.activeReservations ?? 0;
  const capacity = telemetry.availableCapacityPct ?? current?.availableCapacityPct ?? 100.0;
  const details: Record<string, unknown> = {
    ...(current?.probeDetails ?? {}),
    ...(telemetry.probeDetails ?? {}),
  };

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

  await db
    .prepare(
      `INSERT INTO gpu_mesh_region_health (
        region, health_status, p95_latency_ms, error_rate_pct,
        active_reservations, available_capacity_pct, circuit_breaker_state,
        last_probe_at, probe_details, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      ON CONFLICT(region) DO UPDATE SET
        health_status = excluded.health_status,
        p95_latency_ms = excluded.p95_latency_ms,
        error_rate_pct = excluded.error_rate_pct,
        active_reservations = excluded.active_reservations,
        available_capacity_pct = excluded.available_capacity_pct,
        circuit_breaker_state = excluded.circuit_breaker_state,
        last_probe_at = excluded.last_probe_at,
        probe_details = excluded.probe_details,
        updated_at = excluded.updated_at`,
    )
    .bind(
      telemetry.region,
      healthStatus,
      p95Latency,
      errorRate,
      activeRes,
      capacity,
      circuitBreakerState,
      now,
      JSON.stringify(details),
      now,
    )
    .run();

  return {
    region: telemetry.region,
    healthStatus,
    p95LatencyMs: p95Latency,
    errorRatePct: errorRate,
    activeReservations: activeRes,
    availableCapacityPct: capacity,
    circuitBreakerState,
    lastProbeAt: now,
    probeDetails: details,
    updatedAt: now,
  };
}
