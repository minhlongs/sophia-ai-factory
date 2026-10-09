/**
 * Edge GPU Workload Balancer: Cluster Topology & Regional Capacity Aggregator
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 *
 * @module tree/gpu/balancer/topology-service
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type GpuComputeNode,
  type GpuComputeNodeDbRow,
  type GpuMeshTopology,
  type RegionCapacity,
  type GpuComputeRegion,
  type GpuModel,
  mapRowToGpuComputeNode,
} from '@/seed/types/edge-gpu-mesh';

/**
 * Aggregates cluster topology, regional capacities, and hardware model distribution.
 */
export async function getMeshTopology(db: D1Database): Promise<GpuMeshTopology> {
  const rowsResult = await db
    .prepare('SELECT * FROM gpu_compute_nodes ORDER BY region ASC')
    .all<GpuComputeNodeDbRow>();

  const rows = (rowsResult.results ?? []) as GpuComputeNodeDbRow[];
  const nodes = rows.map(mapRowToGpuComputeNode);

  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter((n) => n.status === 'online' || n.status === 'busy').length;
  const degradedNodes = nodes.filter((n) => n.status === 'degraded' || n.status === 'offline').length;
  const totalGpus = nodes.reduce((sum, n) => sum + n.gpuCount, 0);
  const totalVramGb = nodes.reduce((sum, n) => sum + n.totalVramGb, 0);
  const activeRenderJobs = nodes.reduce((sum, n) => sum + n.activeRenderJobs, 0);
  const averageLoadPct =
    totalNodes > 0
      ? Number((nodes.reduce((sum, n) => sum + n.currentLoadPct, 0) / totalNodes).toFixed(2))
      : 0.0;

  // Regional capacities
  const regionMap = new Map<GpuComputeRegion, GpuComputeNode[]>();
  for (const node of nodes) {
    const list = regionMap.get(node.region) ?? [];
    list.push(node);
    regionMap.set(node.region, list);
  }

  const regionCapacities: RegionCapacity[] = Array.from(regionMap.entries()).map(
    ([region, rNodes]) => ({
      region,
      totalNodes: rNodes.length,
      onlineNodes: rNodes.filter((n) => n.status === 'online' || n.status === 'busy').length,
      totalGpus: rNodes.reduce((sum, n) => sum + n.gpuCount, 0),
      totalVramGb: rNodes.reduce((sum, n) => sum + n.totalVramGb, 0),
      averageLoadPct: Number(
        (rNodes.reduce((sum, n) => sum + n.currentLoadPct, 0) / rNodes.length).toFixed(2),
      ),
      activeRenderJobs: rNodes.reduce((sum, n) => sum + n.activeRenderJobs, 0),
    }),
  );

  // Models summary
  const modelsSummary: Record<GpuModel, { count: number; online: number; activeJobs: number }> = {
    H100: { count: 0, online: 0, activeJobs: 0 },
    A100: { count: 0, online: 0, activeJobs: 0 },
    L40S: { count: 0, online: 0, activeJobs: 0 },
    RTX4090: { count: 0, online: 0, activeJobs: 0 },
  };

  for (const node of nodes) {
    if (modelsSummary[node.gpuModel]) {
      modelsSummary[node.gpuModel].count += 1;
      if (node.status === 'online' || node.status === 'busy') {
        modelsSummary[node.gpuModel].online += 1;
      }
      modelsSummary[node.gpuModel].activeJobs += node.activeRenderJobs;
    }
  }

  return {
    totalNodes,
    onlineNodes,
    degradedNodes,
    totalGpus,
    totalVramGb,
    activeRenderJobs,
    averageLoadPct,
    regionCapacities,
    modelsSummary,
  };
}
