/**
 * @file types.ts
 * @description Types for Growth Triad v11 cross-platform arbitrage worker
 */

import type {
  SupportedPlatform,
  SophiaTier,
  PlatformMetricProfile,
  PlatformArbitrageScore,
  HookMutationRequest,
} from '@/seed/types/growth-triad-v11';

export interface ArbitrageRequestedPayload {
  videoId: string;
  userId: string;
  userTier?: SophiaTier;
  primaryPlatform: SupportedPlatform;
  targetPlatforms: SupportedPlatform[];
  metrics: PlatformMetricProfile;
  originalHookText: string;
  durationSeconds?: number;
  velocityScore?: number;
}

export interface ArbitrageWorkerResult {
  status: 'COMPLETED' | 'QUEUED_FOR_OFFPEAK' | 'FAILED';
  decisionId: string;
  videoId: string;
  primaryScore: number;
  syndicationCount: number;
  computeJobId: string;
  priorityLane: string;
  estimatedSavingsUsd: number;
}

export interface BatchSchedulerCronResult {
  status: 'SUCCESS';
  isOffPeak: boolean;
  promotedCount: number;
  leasedCount: number;
  dispatchedCount: number;
  heldInQueueCount: number;
}

export interface ViralityEvaluationResult {
  primaryScore: number;
  syndicationRecommendations: PlatformArbitrageScore[];
  hookMutations: HookMutationRequest[];
}
