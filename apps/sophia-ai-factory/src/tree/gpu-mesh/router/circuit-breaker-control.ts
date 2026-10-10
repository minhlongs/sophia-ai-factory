import type { D1Database } from '@/seed/db/client';
import type { GpuMeshRegion } from '@/seed/types/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';

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
