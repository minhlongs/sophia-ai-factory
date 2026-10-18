/**
 * hectocorn-compute-grid.ts — Tree Layer Pure Domain Engine
 * Hectocorn Multi-Region GPU Grid Orchestrator & Seven-Nines SLA Tracker
 */

import type { HectocornComputeNode, ComputeRegion } from '@/seed/types/hectocorn-compute';
import { evaluateSevenNinesSla } from './hectocorn-sla-evaluator';

export { evaluateSevenNinesSla };

export interface NodeFitnessScore {
  nodeId: string;
  clusterName: string;
  region: ComputeRegion;
  fitnessScore: number; // 0.0 to 1.0 (higher is better)
  availableCapacity: number;
}

export interface DispatchPlan {
  batchId: string;
  totalRenders: number;
  allocations: Array<{ nodeId: string; assignedRenders: number }>;
  estimatedDurationMs: number;
}

/**
 * Calculates fitness score for a compute node:
 * Weights: Health (40%), Available Capacity (30%), Egress Speed (20%), VRAM (10%)
 */
export function calculateNodeFitness(node: HectocornComputeNode): NodeFitnessScore {
  if (node.status !== 'READY') {
    return {
      nodeId: node.id,
      clusterName: node.clusterName,
      region: node.region,
      fitnessScore: 0,
      availableCapacity: 0,
    };
  }

  const availableCapacity = Math.max(0, node.maxConcurrentJobs - node.activeJobsCount);
  const capacityRatio = node.maxConcurrentJobs > 0 ? availableCapacity / node.maxConcurrentJobs : 0;
  const healthComponent = node.nodeHealthScore * 0.4;
  const capacityComponent = capacityRatio * 0.3;
  const egressComponent = Math.min(1.0, node.networkEgressGbps / 100.0) * 0.2;
  const vramComponent = Math.min(1.0, node.totalVramGb / 640.0) * 0.1;

  const fitnessScore = healthComponent + capacityComponent + egressComponent + vramComponent;

  return {
    nodeId: node.id,
    clusterName: node.clusterName,
    region: node.region,
    fitnessScore: Math.round(fitnessScore * 1000) / 1000,
    availableCapacity,
  };
}

/**
 * Plans distribution of a render batch across high-fitness nodes
 */
export function planRenderBatchDispatch(
  batchId: string,
  totalRenders: number,
  nodes: HectocornComputeNode[],
): DispatchPlan {
  if (totalRenders <= 0) {
    throw new Error('Total renders must be positive');
  }

  const scoredNodes = nodes
    .map(calculateNodeFitness)
    .filter((n) => n.fitnessScore > 0 && n.availableCapacity > 0)
    .sort((a, b) => b.fitnessScore - a.fitnessScore);

  if (scoredNodes.length === 0) {
    throw new Error('No available compute nodes in grid');
  }

  const totalCapacity = scoredNodes.reduce((acc, n) => acc + n.availableCapacity, 0);
  let remaining = totalRenders;
  const allocations: Array<{ nodeId: string; assignedRenders: number }> = [];

  for (const node of scoredNodes) {
    if (remaining <= 0) break;
    const share = Math.min(
      remaining,
      Math.ceil((node.availableCapacity / totalCapacity) * totalRenders),
    );
    allocations.push({
      nodeId: node.nodeId,
      assignedRenders: share,
    });
    remaining -= share;
  }

  // Handle any remainder
  if (remaining > 0 && allocations.length > 0) {
    allocations[0].assignedRenders += remaining;
  }

  return {
    batchId,
    totalRenders,
    allocations,
    estimatedDurationMs: Math.round(4200 * Math.max(1, totalRenders / (nodes.length * 64))),
  };
}
