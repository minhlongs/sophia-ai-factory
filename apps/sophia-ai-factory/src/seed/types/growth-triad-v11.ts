/**
 * @file growth-triad-v11.ts
 * @description Seed Layer type definitions and Zod schemas for Growth Triad v11:
 * Cross-Platform Virality Arbitrage, Hook Re-alignment, and Opportunistic Compute Arbitrage.
 * @layer seed
 */

import { z } from 'zod';
import {
  SupportedPlatformSchema,
  SophiaTierSchema,
  TikTokMetricsSchema,
  YouTubeShortsMetricsSchema,
  InstagramReelsMetricsSchema,
  PlatformMetricProfileSchema,
  ArbitrageRecommendationSchema,
  PlatformArbitrageScoreSchema,
  HookMutationStrategySchema,
  HookMetadataTransformSchema,
  HookMutationRequestSchema,
  type SupportedPlatform,
  type SophiaTier,
  type TikTokMetrics,
  type YouTubeShortsMetrics,
  type InstagramReelsMetrics,
  type PlatformMetricProfile,
  type ArbitrageRecommendation,
  type PlatformArbitrageScore,
  type HookMutationStrategy,
  type HookMetadataTransform,
  type HookMutationRequest,
} from './growth-triad-v11-compute';

export {
  SupportedPlatformSchema,
  SophiaTierSchema,
  TikTokMetricsSchema,
  YouTubeShortsMetricsSchema,
  InstagramReelsMetricsSchema,
  PlatformMetricProfileSchema,
  ArbitrageRecommendationSchema,
  PlatformArbitrageScoreSchema,
  HookMutationStrategySchema,
  HookMetadataTransformSchema,
  HookMutationRequestSchema,
  type SupportedPlatform,
  type SophiaTier,
  type TikTokMetrics,
  type YouTubeShortsMetrics,
  type InstagramReelsMetrics,
  type PlatformMetricProfile,
  type ArbitrageRecommendation,
  type PlatformArbitrageScore,
  type HookMutationStrategy,
  type HookMetadataTransform,
  type HookMutationRequest,
};

export const ComputeModelTierSchema = z.enum([
  'PHOTOREAL_EXPENSIVE',
  'STANDARD_BALANCED',
  'ECONOMY_DEGRADED',
]);
export type ComputeModelTier = z.infer<typeof ComputeModelTierSchema>;

export const ComputePrioritySchema = z.enum([
  'IMMEDIATE_PREMIUM',
  'STANDARD',
  'OFF_PEAK_ECONOMIC',
]);
export type ComputePriority = z.infer<typeof ComputePrioritySchema>;

export const ExecutionWindowSchema = z.object({
  earliestExecutionSec: z.number().int().positive(),
  latestExecutionSec: z.number().int().positive(),
  isOffPeak: z.boolean().default(false),
});
export type ExecutionWindow = z.infer<typeof ExecutionWindowSchema>;

export const ComputeJobArbitrageSpecSchema = z.object({
  jobId: z.string().min(1),
  videoId: z.string().min(1),
  userTier: SophiaTierSchema,
  velocityScore: z.number().min(0).max(100),
  priority: ComputePrioritySchema,
  targetModelTier: ComputeModelTierSchema,
  executionWindow: ExecutionWindowSchema,
  estimatedCostUsd: z.number().nonnegative(),
  estimatedSavingsUsd: z.number().nonnegative(),
  discountRatio: z.number().min(0).max(1),
});
export type ComputeJobArbitrageSpec = z.infer<typeof ComputeJobArbitrageSpecSchema>;

export const ArbitrageDecisionStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'QUEUED',
  'EXECUTING',
  'COMPLETED',
  'REJECTED',
]);
export type ArbitrageDecisionStatus = z.infer<typeof ArbitrageDecisionStatusSchema>;

export const ArbitrageDecisionSchema = z.object({
  decisionId: z.string().min(1),
  videoId: z.string().min(1),
  userId: z.string().min(1),
  primaryPlatform: SupportedPlatformSchema,
  syndicationPlatforms: z.array(SupportedPlatformSchema),
  scores: z.record(SupportedPlatformSchema, PlatformArbitrageScoreSchema),
  computeSpec: ComputeJobArbitrageSpecSchema,
  hookMutations: z.array(HookMutationRequestSchema),
  status: ArbitrageDecisionStatusSchema,
  createdAt: z.number().int().positive().default(() => Math.floor(Date.now() / 1000)),
  updatedAt: z.number().int().positive().default(() => Math.floor(Date.now() / 1000)),
});
export type ArbitrageDecision = z.infer<typeof ArbitrageDecisionSchema>;
