/**
 * Edge region heartbeat executor for multi-cloud mesh
 * @module land/multicloud/actions/edge-region-heartbeat
 */

import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  HeartbeatRegionInput,
  MulticloudActionError,
} from './types';

export async function executeHeartbeatEdgeRegion(
  db: D1Database,
  input: HeartbeatRegionInput,
): Promise<Result<{ acknowledged: boolean }, MulticloudActionError>> {
  try {
    if (!input.regionId) {
      return failure({ code: 'VALIDATION_ERROR', message: 'regionId is required.' });
    }

    const now = Date.now();
    const isHealthy = (input.healthScore >= 0.8 && input.p95LatencyMs <= 75.0) ? 1 : 0;
    const consecutiveFailures = isHealthy ? 0 : (input.consecutiveFailures ?? 1);
    const status = isHealthy ? 'active' : 'degraded';

    await db
      .prepare(`
        UPDATE multicloud_edge_regions
        SET
          p95_latency_ms = ?1,
          p99_latency_ms = ?2,
          health_score = ?3,
          active_requests = ?4,
          is_healthy = ?5,
          consecutive_health_failures = ?6,
          status = ?7,
          gpu_capacity_allocated = COALESCE(?8, gpu_capacity_allocated),
          last_heartbeat_at = ?9,
          updated_at = ?9
        WHERE id = ?10
      `)
      .bind(
        input.p95LatencyMs,
        input.p99LatencyMs,
        input.healthScore,
        input.activeRequests,
        isHealthy,
        consecutiveFailures,
        status,
        input.gpuCapacityAllocated ?? null,
        now,
        input.regionId,
      )
      .run();

    return success({ acknowledged: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] heartbeatEdgeRegionAction failed', { error: message });
    return failure({ code: 'HEARTBEAT_ERROR', message });
  }
}
