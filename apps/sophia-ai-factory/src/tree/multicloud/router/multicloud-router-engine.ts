/**
 * Multi-Cloud Edge Traffic Router & Sub-30ms Failover Engine
 *
 * Implements:
 * - Deterministic edge route selection with p95 latency & geo prioritization
 * - GPU video burst dispatch for compute-intensive video generation
 * - Autonomous sub-30ms failover engine on latency/health anomaly
 *
 * Layer: tree/multicloud/router
 */

import type { D1Database } from '@/seed/db/client';
import { mapRowToEdgeRegion } from '@/seed/types/multicloud-mesh';
import type {
  MulticloudEdgeRegionRow,
  RouteRequestInput,
  RouteDecisionResult,
} from './types';

export { executeSub30msFailover } from './multicloud-failover-executor';

/**
 * Resolves optimal edge node for incoming request
 */
export async function resolveOptimalEdgeRoute(
  db: D1Database,
  input: RouteRequestInput,
): Promise<RouteDecisionResult> {
  // Route to healthy GPU burst node if video burst requires GPU capacity
  if (input.workloadType === 'video_generation_burst' && (input.requiredGpuUnits ?? 1) > 0) {
    const requiredGpu = input.requiredGpuUnits ?? 1;
    const { results: gpuNodes } = await db
      .prepare(`
        SELECT * FROM multicloud_edge_regions
        WHERE tier_role = 'gpu_burst_node' AND status = 'active' AND is_healthy = 1
          AND (gpu_capacity_total - gpu_capacity_allocated) >= ?1
        ORDER BY CASE WHEN geographic_zone = ?2 THEN 0 ELSE 1 END ASC, p95_latency_ms ASC
        LIMIT 1
      `)
      .bind(requiredGpu, input.geographicZone)
      .all<MulticloudEdgeRegionRow>();

    if (gpuNodes && gpuNodes.length > 0) {
      const node = mapRowToEdgeRegion(gpuNodes[0]);
      return {
        selectedRegionId: node.id,
        regionCode: node.regionCode,
        provider: node.provider,
        tierRole: node.tierRole,
        targetEndpointUrl: node.endpointUrl,
        estimatedLatencyMs: node.p95LatencyMs,
        isGpuBurst: true,
        isFallback: false,
        routingReason: `Routed to GPU video burst node in ${node.geographicZone} (${node.provider})`,
        resolvedAt: Date.now(),
      };
    }
  }

  // Standard edge routing: Prefer Cloudflare Primary in matching zone
  const { results: candidates } = await db
    .prepare(`
      SELECT * FROM multicloud_edge_regions
      WHERE status = 'active' AND is_healthy = 1 AND tier_role IN ('primary_edge', 'fallback_edge')
      ORDER BY
        CASE WHEN geographic_zone = ?1 THEN 0 ELSE 1 END ASC,
        CASE WHEN tier_role = 'primary_edge' THEN 0 ELSE 1 END ASC,
        p95_latency_ms ASC
      LIMIT 5
    `)
    .bind(input.geographicZone)
    .all<MulticloudEdgeRegionRow>();

  if (!candidates || candidates.length === 0) {
    throw new Error('NO_HEALTHY_REGIONS: No healthy edge regions available across multi-cloud federation.');
  }

  const best = mapRowToEdgeRegion(candidates[0]);
  return {
    selectedRegionId: best.id,
    regionCode: best.regionCode,
    provider: best.provider,
    tierRole: best.tierRole,
    targetEndpointUrl: best.endpointUrl,
    estimatedLatencyMs: best.p95LatencyMs,
    isGpuBurst: false,
    isFallback: best.tierRole === 'fallback_edge',
    routingReason: best.tierRole === 'primary_edge'
      ? `Primary edge match in ${best.geographicZone}`
      : `Fallback edge routed due to regional primary unavailability`,
    resolvedAt: Date.now(),
  };
}
