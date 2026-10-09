/**
 * Edge GPU Workload Balancer: Render Duration & Cost Metrics Estimator
 *
 * Implements hardware model multipliers and resolution throughput calculations.
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 *
 * @module tree/gpu/balancer/render-metrics
 */

import {
  type GpuComputeNode,
  type VideoRenderJobInput,
  type GpuModel,
} from '@/seed/types/edge-gpu-mesh';

/**
 * Calculates estimated rendering duration and cost for a job on a specific node.
 */
export function estimateRenderMetrics(
  node: GpuComputeNode,
  job: VideoRenderJobInput,
): { estimatedDurationMs: number; estimatedCostCents: number } {
  // Base render throughput multipliers (duration per 1s of video)
  const modelMultipliers: Record<GpuModel, number> = {
    H100: 0.1,
    A100: 0.15,
    L40S: 0.18,
    RTX4090: 0.22,
  };

  const resMultipliers: Record<string, number> = {
    '720p': 0.5,
    '1080p': 0.75,
    '4K': 1.0,
    '8K': 2.5,
  };

  const baseRate = modelMultipliers[node.gpuModel] ?? 0.15;
  const resRate = resMultipliers[job.videoResolution] ?? 1.0;
  const loadPenalty = 1 + (node.currentLoadPct / 100) * 0.4;

  const rawDurationSeconds = job.videoDurationSeconds * baseRate * resRate * loadPenalty;
  const estimatedDurationMs = Math.max(500, Math.round(rawDurationSeconds * 1000));

  const hourlyRateCents =
    job.allowSpot !== false ? node.spotPriceCentsPerHour : node.onDemandPriceCentsPerHour;
  const hours = estimatedDurationMs / (3600 * 1000);
  const estimatedCostCents = Math.max(1, Math.ceil(hours * hourlyRateCents));

  return { estimatedDurationMs, estimatedCostCents };
}
