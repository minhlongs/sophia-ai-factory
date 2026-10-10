import type { D1Database } from '@/seed/db/client';
import type {
  GpuMeshRegion,
  GpuMeshRegionHealth,
  GpuMeshRegionHealthRow,
  CircuitBreakerState,
  RegionHealthStatus,
} from '@/seed/types/gpu-mesh';
import {
  mapRowToRegionHealth,
  ALL_GPU_MESH_REGIONS,
} from '@/seed/types/gpu-mesh';
import { GPU_MESH_REGIONS_CONFIG } from '@/seed/config/gpu-mesh';
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
