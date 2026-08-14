/**
 * Output quality and reliability scoring for provider scoring engine.
 *
 * Computes quality scores from tool metadata and stability tiers.
 * Computes reliability scores from historical success rates.
 *
 * @module seed/ai/scoring-quality
 */

import type { ToolInfo } from './provider-scoring-types';

/**
 * Compute output quality score for a tool.
 *
 * Uses measured quality score if available, otherwise falls back to
 * stability tier heuristic with generate-tier bonus.
 *
 * @param tool - Tool metadata
 * @param statusValue - Stability tier string ("production" | "beta" | "experimental")
 * @returns Quality score between 0 and 1
 */
export function computeOutputQuality(
  tool: ToolInfo,
  statusValue: string,
): number {
  if (tool.qualityScore !== undefined) {
    return tool.qualityScore;
  }

  const qualityMap: Record<string, number> = {
    production: 0.9,
    beta: 0.7,
    experimental: 0.4,
  };

  let quality = qualityMap[statusValue] ?? 0.5;

  // Generate-tier bonus: production-stable generate tools get a nudge
  if (tool.tier === 'generate' && statusValue === 'production') {
    quality = Math.min(1.0, quality + 0.05);
  }

  return quality;
}

/**
 * Compute reliability score for a tool.
 *
 * Uses measured reliability score if available, otherwise falls back to
 * stability tier heuristic.
 *
 * @param tool - Tool metadata
 * @param statusValue - Stability tier string ("production" | "beta" | "experimental")
 * @returns Reliability score between 0 and 1
 */
export function computeReliability(
  tool: ToolInfo,
  statusValue: string,
): number {
  if (tool.historicalSuccessRate !== undefined) {
    return tool.historicalSuccessRate;
  }

  const reliabilityMap: Record<string, number> = {
    production: 0.95,
    beta: 0.8,
    experimental: 0.4,
  };

  return reliabilityMap[statusValue] ?? 0.5;
}

/**
 * Compute latency score for a tool.
 *
 * Uses measured p50 latency if available, otherwise falls back to
 * runtime class heuristic (local > hybrid > api).
 *
 * @param tool - Tool metadata
 * @returns Latency score between 0 and 1
 */
export function computeLatency(tool: ToolInfo): number {
  if (tool.latencyP50Seconds !== undefined) {
    const p50 = tool.latencyP50Seconds;
    if (p50 <= 1.0) return 1.0;
    if (p50 <= 10.0) return 0.8;
    if (p50 <= 30.0) return 0.6;
    if (p50 <= 60.0) return 0.4;
    return 0.2;
  }

  const runtime = tool.runtime ?? 'api';
  if (runtime === 'local' || runtime === 'local_gpu') return 0.9;
  if (runtime === 'hybrid') return 0.6;
  return 0.4;
}
