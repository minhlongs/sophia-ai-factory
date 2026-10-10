/**
 * Arbitrage Types & DTOs
 * Layer: Land (Growth)
 */

export type DestinationPlatform = 'TIKTOK' | 'YOUTUBE_SHORTS' | 'INSTAGRAM_REELS';

export interface PlatformMetricProfile {
  platform: DestinationPlatform;
  completionRate?: number;
  rewatchRate?: number;
  viewedVsSwipedRate?: number;
  dmShareRate?: number;
  saveRate?: number;
}

export interface HookAlignmentSpec {
  platform: DestinationPlatform;
  governingMetric: string;
  calculatedScore: number;
  hookMutation: string;
  status: 'OPTIMIZED' | 'QUEUED' | 'PENDING';
  divergenceJsd: number;
}

export type ComputeRegime = 'REALTIME_PHOTOREAL' | 'EXPRESS_DEGRADED' | 'OFF_PEAK_QUEUE';

export interface ComputeArbitrageDecision {
  regime: ComputeRegime;
  targetProvider: string;
  estimatedCostSavingsUsd: number;
  reason: string;
}

export interface ArbitrageEvaluationResult {
  logId: string;
  videoId: string;
  tenantId: string;
  timestamp: number;
  platformScores: Record<DestinationPlatform, number>;
  hookAlignments: HookAlignmentSpec[];
  computeDecision: ComputeArbitrageDecision;
  baselineReach: number;
  syndicatedReach: number;
  reachLiftMultiplier: number;
  shadowbanAvoidanceRate: number;
}

export interface ArbitrageDashboardMetrics {
  reachLiftPercentage: number;
  totalComputeSavingsUsd: number;
  activeHookDivergenceJsd: number;
  shadowbanAvoidanceRate: number;
  platformMatrix: HookAlignmentSpec[];
  computeRegime: ComputeRegime;
}
