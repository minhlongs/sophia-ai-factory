/**
 * Global Multi-Region Failover Mesh Router
 *
 * Layer: tree/gpu-mesh (Domain services & pure algorithms)
 *
 * Implements:
 * - Deterministic latency-aware fallback routing across APAC, US, and EU
 * - Region circuit breaker state arbitration (CLOSED, HALF_OPEN, OPEN)
 * - P95 SLA latency threshold verification (default 1500ms ceiling)
 * - Degradation detection with graceful best-effort failover
 *
 * @module tree/gpu-mesh/multi-region-router
 */

import type { D1Database } from '@/seed/db/client';
import type {
  GpuMeshRegion,
  EnterpriseGpuReservation,
  GpuMeshRegionHealth,
  GpuMeshRegionHealthRow,
  FailoverRouteResult,
  CircuitBreakerState,
  RegionHealthStatus,
} from '@/seed/types/gpu-mesh';
import {
  mapRowToRegionHealth,
  ALL_GPU_MESH_REGIONS,
} from '@/seed/types/gpu-mesh';
import {
  GPU_MESH_REGIONS_CONFIG,
  GPU_MESH_CIRCUIT_BREAKER_CONFIG,
} from '@/seed/config/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Fetch health status and telemetry for all GPU mesh regions
 */
export async function getRegionsHealth(db: D1Database): Promise<GpuMeshRegionHealth[]> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM gpu_mesh_region_health ORDER BY region ASC')
      .all<GpuMeshRegionHealthRow>();

    if (results && results.length > 0) {
      return results.map(mapRowToRegionHealth);
    }
  } catch (error) {
    logger.warn('[gpu-mesh] Error querying gpu_mesh_region_health', {
      error: String(error),
    });
  }

  // Fallback to static defaults if DB empty or unavailable
  const now = Math.floor(Date.now() / 1000);
  return ALL_GPU_MESH_REGIONS.map((region) => {
    const config = GPU_MESH_REGIONS_CONFIG[region];
    return {
      region,
      healthStatus: 'healthy' as RegionHealthStatus,
      p95LatencyMs: config.defaultP95LatencyMs,
      errorRatePct: 0.0,
      activeReservations: 0,
      availableCapacityPct: 100.0,
      circuitBreakerState: 'CLOSED' as CircuitBreakerState,
      lastProbeAt: now,
      probeDetails: {},
      updatedAt: now,
    };
  });
}

/**
 * Fetch health status for a single region
 */
export async function getRegionHealth(
  db: D1Database,
  region: GpuMeshRegion,
): Promise<GpuMeshRegionHealth | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM gpu_mesh_region_health WHERE region = ?1 LIMIT 1')
      .bind(region)
      .first<GpuMeshRegionHealthRow>();

    if (!row) return null;
    return mapRowToRegionHealth(row);
  } catch (error) {
    logger.warn('[gpu-mesh] Error fetching health for region', {
      region,
      error: String(error),
    });
    return null;
  }
}

/**
 * Resolve optimal execution region for an enterprise reservation using deterministic
 * latency-aware fallback routing across APAC, US, and EU edge clusters.
 */
export async function resolveOptimalRegion(
  db: D1Database,
  reservation: EnterpriseGpuReservation,
  customCandidateRegions?: GpuMeshRegion[],
): Promise<FailoverRouteResult> {
  const regionsToTry: GpuMeshRegion[] = [];
  const initialCandidates = customCandidateRegions ?? [
    reservation.primaryRegion,
    ...reservation.fallbackRegions,
  ];

  // Deduplicate candidate regions preserving order
  for (const reg of initialCandidates) {
    if (!regionsToTry.includes(reg)) {
      regionsToTry.push(reg);
    }
  }

  // Ensure all regions are included as ultimate failover fallbacks
  for (const reg of ALL_GPU_MESH_REGIONS) {
    if (!regionsToTry.includes(reg)) {
      regionsToTry.push(reg);
    }
  }

  const regionHealthList = await getRegionsHealth(db);

  // Evaluate candidate regions in priority order
  for (let hop = 0; hop < regionsToTry.length; hop++) {
    const candidateRegion = regionsToTry[hop];
    const health = regionHealthList.find((r) => r.region === candidateRegion);

    if (!health) continue;

    // Region is viable if:
    // 1. Circuit breaker is not OPEN
    // 2. Health status is not 'unhealthy'
    // 3. P95 latency is within reservation SLA ceiling
    const isCircuitClosedOrHalfOpen = health.circuitBreakerState !== 'OPEN';
    const isNotUnhealthy = health.healthStatus !== 'unhealthy';
    const isLatencyWithinSla = health.p95LatencyMs <= reservation.slaP95LatencyMs;

    if (isCircuitClosedOrHalfOpen && isNotUnhealthy && isLatencyWithinSla) {
      const isFailover = hop > 0;
      const reason =
        hop === 0
          ? 'PRIMARY_HEALTHY'
          : `FAILOVER_FROM_${reservation.primaryRegion.toUpperCase()}`;

      logger.info('[gpu-mesh] Resolved execution region', {
        reservationId: reservation.id,
        selectedRegion: candidateRegion,
        primaryRegion: reservation.primaryRegion,
        isFailover,
        hop,
        p95LatencyMs: health.p95LatencyMs,
      });

      return {
        selectedRegion: candidateRegion,
        isFailover,
        failoverHops: hop,
        reason,
        p95LatencyMs: health.p95LatencyMs,
        circuitBreakerState: health.circuitBreakerState,
      };
    }
  }

  // If all preferred regions are degraded/unhealthy, choose the region with:
  // 1. Circuit breaker not OPEN (if any)
  // 2. Lowest error rate
  // 3. Lowest P95 latency
  const eligibleCandidates = [...regionHealthList].sort((a, b) => {
    if (a.circuitBreakerState === 'OPEN' && b.circuitBreakerState !== 'OPEN') return 1;
    if (a.circuitBreakerState !== 'OPEN' && b.circuitBreakerState === 'OPEN') return -1;
    if (a.errorRatePct !== b.errorRatePct) return a.errorRatePct - b.errorRatePct;
    return a.p95LatencyMs - b.p95LatencyMs;
  });

  const bestDegraded = eligibleCandidates[0];
  const selectedRegion = bestDegraded?.region ?? reservation.primaryRegion;

  logger.warn('[gpu-mesh] All preferred regions degraded — routing to best effort fallback', {
    reservationId: reservation.id,
    selectedRegion,
    primaryRegion: reservation.primaryRegion,
    candidatesEvaluated: regionsToTry,
  });

  return {
    selectedRegion,
    isFailover: true,
    failoverHops: regionsToTry.length,
    reason: 'ALL_REGIONS_DEGRADED_BEST_EFFORT',
    p95LatencyMs: bestDegraded?.p95LatencyMs,
    circuitBreakerState: bestDegraded?.circuitBreakerState,
  };
}

export interface RegionTelemetryUpdate {
  region: GpuMeshRegion;
  p95LatencyMs?: number;
  errorRatePct?: number;
  activeReservations?: number;
  availableCapacityPct?: number;
  probeDetails?: Record<string, unknown>;
  probeTimestamp?: number;
}

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
      // Cooldown period active: remain OPEN
      circuitBreakerState = 'OPEN';
      healthStatus = 'unhealthy';
      consecutiveSuccesses = 0;
    } else {
      // Cooldown period elapsed: probe trial
      if (!isHealthy) {
        // Probe failed: remain OPEN and reset trip time
        circuitBreakerState = 'OPEN';
        healthStatus = 'unhealthy';
        consecutiveSuccesses = 0;
        details.trippedAt = now;
      } else {
        // Probe healthy: transition to HALF_OPEN trial state with 1 consecutive success
        circuitBreakerState = 'HALF_OPEN';
        healthStatus = 'degraded';
        consecutiveSuccesses = 1;
        delete details.trippedAt;
      }
    }
  } else if (circuitBreakerState === 'HALF_OPEN') {
    if (!isHealthy) {
      // Failed probe while HALF_OPEN: immediately re-trip to OPEN
      circuitBreakerState = 'OPEN';
      healthStatus = 'unhealthy';
      consecutiveSuccesses = 0;
      details.trippedAt = now;
    } else {
      // Successful probe in HALF_OPEN: increment consecutive successes
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
    // Current state is CLOSED (or initial state)
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

/**
 * Manually or programmatically trip a region's circuit breaker to OPEN
 */
export async function tripCircuitBreaker(
  db: D1Database,
  region: GpuMeshRegion,
  reason: string,
  nowSeconds?: number,
): Promise<boolean> {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  try {
    const res = await db
      .prepare(
        `UPDATE gpu_mesh_region_health
         SET circuit_breaker_state = 'OPEN',
             health_status = 'unhealthy',
             last_probe_at = ?2,
             probe_details = json_set(COALESCE(probe_details, '{}'), '$.tripReason', ?1, '$.trippedAt', ?2, '$.consecutiveSuccesses', 0),
             updated_at = ?2
         WHERE region = ?3`,
      )
      .bind(reason, now, region)
      .run();

    logger.warn('[gpu-mesh] Tripped regional circuit breaker to OPEN', {
      region,
      reason,
    });
    return res.success;
  } catch (error) {
    logger.error('[gpu-mesh] Error tripping circuit breaker', {
      region,
      error: String(error),
    });
    return false;
  }
}

/**
 * Reset a region's circuit breaker back to CLOSED
 */
export async function resetCircuitBreaker(
  db: D1Database,
  region: GpuMeshRegion,
  nowSeconds?: number,
): Promise<boolean> {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  try {
    const res = await db
      .prepare(
        `UPDATE gpu_mesh_region_health
         SET circuit_breaker_state = 'CLOSED',
             health_status = 'healthy',
             error_rate_pct = 0.0,
             last_probe_at = ?1,
             probe_details = json_set(COALESCE(probe_details, '{}'), '$.resetAt', ?1, '$.consecutiveSuccesses', 0),
             updated_at = ?1
         WHERE region = ?2`,
      )
      .bind(now, region)
      .run();

    logger.info('[gpu-mesh] Reset regional circuit breaker to CLOSED', {
      region,
    });
    return res.success;
  } catch (error) {
    logger.error('[gpu-mesh] Error resetting circuit breaker', {
      region,
      error: String(error),
    });
    return false;
  }
}
