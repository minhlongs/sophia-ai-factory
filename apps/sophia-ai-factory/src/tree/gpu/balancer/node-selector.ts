/**
 * Edge GPU Workload Balancer: Composite Fitness Scoring & Optimal Node Selection
 *
 * Implements:
 * - Multi-factor composite fitness scoring (load 35%, latency 25%, spot 20%, health 20%)
 * - Hardware model & VRAM constraint verification for 4K / 8K rendering
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 *
 * @module tree/gpu/balancer/node-selector
 */

import {
  type GpuComputeNode,
  type VideoRenderJobInput,
  FITNESS_WEIGHTS,
  RESOLUTION_VRAM_MIN_GB,
} from '@/seed/types/edge-gpu-mesh';

/**
 * Calculates multi-factor fitness score (0.0 to 100.0+) for a GPU node against a job.
 *
 * Composite Weights:
 * - Load Score: 35%
 * - Latency Score: 25%
 * - Spot Cost Advantage: 20%
 * - Health Score: 20%
 * - Regional Proximity Bonus: +10 points
 */
export function calculateNodeFitnessScore(
  node: GpuComputeNode,
  job: VideoRenderJobInput,
): number {
  if (!node.isHealthy || node.status === 'offline' || node.status === 'degraded') {
    return 0;
  }

  // 1. Load Score (0 - 35 points): lower load = higher score
  const availableCapacityPct = Math.max(0, 100 - node.currentLoadPct);
  const loadScore = (availableCapacityPct / 100) * 100 * FITNESS_WEIGHTS.LOAD;

  // 2. Latency Score (0 - 25 points): lower p95 latency = higher score
  const clampedLatency = Math.min(Math.max(0, node.p95LatencyMs), 100);
  const latencyScore = ((100 - clampedLatency) / 100) * 100 * FITNESS_WEIGHTS.LATENCY;

  // 3. Spot Cost Advantage (0 - 20 points): higher discount vs on-demand = higher score
  let spotDiscount = 0;
  if (node.onDemandPriceCentsPerHour > 0) {
    spotDiscount = Math.max(
      0,
      (node.onDemandPriceCentsPerHour - node.spotPriceCentsPerHour) /
        node.onDemandPriceCentsPerHour,
    );
  }
  const spotScore = spotDiscount * 100 * FITNESS_WEIGHTS.SPOT_PRICE;

  // 4. Health Score (0 - 20 points): health_score ranges 0.0 to 1.0
  const healthScore = Math.max(0, Math.min(1.0, node.healthScore)) * 100 * FITNESS_WEIGHTS.HEALTH;

  // 5. Preferred Region Bonus (+10 points)
  const regionBonus =
    job.preferredRegion && node.region === job.preferredRegion ? 10.0 : 0.0;

  const totalScore = Number(
    (loadScore + latencyScore + spotScore + healthScore + regionBonus).toFixed(3),
  );
  return totalScore;
}

/**
 * Validates hardware requirements and selects the highest scoring node.
 */
export function selectOptimalComputeNode(
  nodes: GpuComputeNode[],
  job: VideoRenderJobInput,
): GpuComputeNode {
  const minVramGb = RESOLUTION_VRAM_MIN_GB[job.videoResolution] ?? 24;
  const requestedCodec = job.codec ?? 'h264';

  const candidates = nodes.filter((node) => {
    if (!node.isHealthy) return false;
    if (node.status === 'offline' || node.status === 'degraded' || node.status === 'draining') {
      return false;
    }
    if (node.vramGbPerGpu < minVramGb) return false;
    if (node.activeRenderJobs >= node.maxConcurrency) return false;
    if (node.currentLoadPct >= 98.0) return false;

    if (job.videoResolution === '8K' && node.maxResolution !== '8K') return false;
    if (
      job.videoResolution === '4K' &&
      node.maxResolution !== '4K' &&
      node.maxResolution !== '8K'
    ) {
      return false;
    }

    if (node.supportedCodecs.length > 0 && !node.supportedCodecs.includes(requestedCodec)) {
      return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    const fallbackCandidates = nodes.filter(
      (n) => n.isHealthy && n.status !== 'offline' && n.vramGbPerGpu >= minVramGb,
    );
    if (fallbackCandidates.length > 0) {
      fallbackCandidates.sort((a, b) => b.healthScore - a.healthScore);
      return fallbackCandidates[0];
    }
    throw new Error(
      `No available GPU compute node found matching resolution ${job.videoResolution} and codec ${requestedCodec}`,
    );
  }

  candidates.sort((a, b) => {
    const scoreA = calculateNodeFitnessScore(a, job);
    const scoreB = calculateNodeFitnessScore(b, job);
    return scoreB - scoreA;
  });

  return candidates[0];
}
