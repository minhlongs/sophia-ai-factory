import type { D1Database } from '@/seed/db/client';
import type {
  GpuMeshRegion,
  EnterpriseGpuReservation,
  FailoverRouteResult,
} from '@/seed/types/gpu-mesh';
import { ALL_GPU_MESH_REGIONS } from '@/seed/types/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';
import { getRegionsHealth } from './region-health-checker';

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

  // If all preferred regions are degraded/unhealthy, choose the best effort fallback
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
