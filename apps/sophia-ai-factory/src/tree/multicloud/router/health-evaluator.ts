/**
 * Multi-Cloud Health Evaluator & Split-Brain Arbitration Engine
 *
 * Implements:
 * - Split-brain Byzantine quorum arbitration
 * - Topology health evaluation
 *
 * Layer: tree/multicloud/router
 */

import type { D1Database } from '@/seed/db/client';
import { mapRowToEdgeRegion } from '@/seed/types/multicloud-mesh';
import type {
  MulticloudEdgeRegion,
  MulticloudEdgeRegionRow,
  MulticloudMeshTopology,
  GeographicZone,
} from './types';

/**
 * Resolves split-brain network partition by enforcing Byzantine quorum majority
 */
export function arbitrateSplitBrainPartition(
  partitionA: MulticloudEdgeRegion[],
  partitionB: MulticloudEdgeRegion[],
): { winningPartition: 'A' | 'B'; quorumCount: number; reason: string } {
  const healthyA = partitionA.filter((n) => n.isHealthy && n.status === 'active');
  const healthyB = partitionB.filter((n) => n.isHealthy && n.status === 'active');

  // Rule 1: Majority active node count
  if (healthyA.length !== healthyB.length) {
    const winning = healthyA.length > healthyB.length ? 'A' : 'B';
    return {
      winningPartition: winning,
      quorumCount: Math.max(healthyA.length, healthyB.length),
      reason: `Quorum majority (${healthyA.length} vs ${healthyB.length})`,
    };
  }

  // Rule 2: Lower average p95 latency
  const avgLatA = healthyA.reduce((acc, n) => acc + n.p95LatencyMs, 0) / (healthyA.length || 1);
  const avgLatB = healthyB.reduce((acc, n) => acc + n.p95LatencyMs, 0) / (healthyB.length || 1);

  if (avgLatA < avgLatB) {
    return {
      winningPartition: 'A',
      quorumCount: healthyA.length,
      reason: `Tie-breaker: Lower average p95 latency (${avgLatA.toFixed(1)}ms vs ${avgLatB.toFixed(1)}ms)`,
    };
  }

  if (avgLatB < avgLatA) {
    return {
      winningPartition: 'B',
      quorumCount: healthyB.length,
      reason: `Tie-breaker: Lower average p95 latency (${avgLatB.toFixed(1)}ms vs ${avgLatB.toFixed(1)}ms)`,
    };
  }

  // Rule 3: Higher average health score
  const avgHealthA = healthyA.reduce((acc, n) => acc + n.healthScore, 0) / (healthyA.length || 1);
  const avgHealthB = healthyB.reduce((acc, n) => acc + n.healthScore, 0) / (healthyB.length || 1);

  if (avgHealthA >= avgHealthB) {
    return {
      winningPartition: 'A',
      quorumCount: healthyA.length,
      reason: `Tie-breaker: Higher health score (${avgHealthA.toFixed(2)} vs ${avgHealthB.toFixed(2)})`,
    };
  }

  return {
    winningPartition: 'B',
    quorumCount: healthyB.length,
    reason: `Tie-breaker: Higher health score (${avgHealthB.toFixed(2)} vs ${avgHealthA.toFixed(2)})`,
  };
}

/**
 * Retrieves cluster topology for multi-cloud edge federation
 */
export async function getMulticloudTopology(db: D1Database): Promise<MulticloudMeshTopology> {
  const { results } = await db
    .prepare('SELECT * FROM multicloud_edge_regions ORDER BY p95_latency_ms ASC')
    .all<MulticloudEdgeRegionRow>();

  const regions = (results ?? []).map(mapRowToEdgeRegion);
  const activeCount = regions.filter((r) => r.status === 'active').length;
  const degradedCount = regions.filter((r) => r.status === 'degraded' || r.status === 'failing').length;
  const primary = regions.find((r) => r.tierRole === 'primary_edge' && r.isHealthy);

  const breakdown: Record<GeographicZone, number> = {
    apac: 0,
    nam: 0,
    emea: 0,
    latam: 0,
    global: 0,
  };

  for (const r of regions) {
    breakdown[r.geographicZone] = (breakdown[r.geographicZone] ?? 0) + 1;
  }

  return {
    totalRegions: regions.length,
    activeRegionsCount: activeCount,
    degradedRegionsCount: degradedCount,
    primaryEdgeRegionId: primary?.id ?? null,
    regionalBreakdown: breakdown,
    regions,
  };
}
