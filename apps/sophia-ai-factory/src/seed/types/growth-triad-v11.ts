/**
 * @file growth-triad-v11.ts
 * @description Seed Layer type definitions and Zod schemas for Growth Triad v11:
 * Cross-Platform Virality Arbitrage, Hook Re-alignment, and Opportunistic Compute Arbitrage.
 * @layer seed
 */

import { z } from 'zod';

// ============================================================================
// Supported Platforms & Canonical Enums
// ============================================================================

export const SupportedPlatformSchema = z.enum([
  'TIKTOK',
  'YOUTUBE_SHORTS',
  'INSTAGRAM_REELS',
]);
export type SupportedPlatform = z.infer<typeof SupportedPlatformSchema>;

export const SophiaTierSchema = z.enum([
  'BASIC',
  'PREMIUM',
  'ENTERPRISE',
  'MASTER',
]);
export type SophiaTier = z.infer<typeof SophiaTierSchema>;

// ============================================================================
// 1. Platform Metric Profiles
// ============================================================================

export const TikTokMetricsSchema = z.object({
  completionRate: z.number().min(0).max(1),
  rewatchRate: z.number().min(0).max(1),
  shareRate: z.number().min(0).max(1),
  retentionAt3s: z.number().min(0).max(1),
  likeRate: z.number().min(0).max(1).default(0),
  commentRate: z.number().min(0).max(1).default(0),
});
export type TikTokMetrics = z.infer<typeof TikTokMetricsSchema>;

export const YouTubeShortsMetricsSchema = z.object({
  viewedVsSwipedRate: z.number().min(0).max(1),
  completionRate: z.number().min(0).max(1),
  engagementLikes: z.number().min(0).max(1).default(0),
  subscriptionGainRate: z.number().min(0).max(1).default(0),
  averagePercentageViewed: z.number().min(0).default(1.0),
});
export type YouTubeShortsMetrics = z.infer<typeof YouTubeShortsMetricsSchema>;

export const InstagramReelsMetricsSchema = z.object({
  directMessageShareRate: z.number().min(0).max(1),
  saveRate: z.number().min(0).max(1),
  completionRate: z.number().min(0).max(1),
  commentRate: z.number().min(0).max(1).default(0),
  likeRate: z.number().min(0).max(1).default(0),
});
export type InstagramReelsMetrics = z.infer<typeof InstagramReelsMetricsSchema>;

export const PlatformMetricProfileSchema = z.object({
  videoId: z.string().min(1),
  tiktok: TikTokMetricsSchema.optional(),
  youtubeShorts: YouTubeShortsMetricsSchema.optional(),
  instagramReels: InstagramReelsMetricsSchema.optional(),
  observedViews: z.number().int().nonnegative().default(0),
  collectedAt: z.number().int().positive().default(() => Math.floor(Date.now() / 1000)),
});
export type PlatformMetricProfile = z.infer<typeof PlatformMetricProfileSchema>;

// ============================================================================
// 2. Platform Arbitrage Score
// ============================================================================

export const ArbitrageRecommendationSchema = z.enum([
  'PRIMARY_TARGET',
  'SYNDICATE',
  'HOLD',
  'SKIP',
]);
export type ArbitrageRecommendation = z.infer<typeof ArbitrageRecommendationSchema>;

export const PlatformArbitrageScoreSchema = z.object({
  platform: SupportedPlatformSchema,
  viralityScore: z.number().min(0).max(100),
  expectedMultiplier: z.number().positive(),
  confidenceScore: z.number().min(0).max(1),
  retentionIndex: z.number().min(0).max(100),
  engagementIndex: z.number().min(0).max(100),
  recommendation: ArbitrageRecommendationSchema,
  reasoning: z.string().min(1),
});
export type PlatformArbitrageScore = z.infer<typeof PlatformArbitrageScoreSchema>;

// ============================================================================
// 3. Hook Mutation Request
// ============================================================================

export const HookMutationStrategySchema = z.enum([
  'CURIOSITY_PUNCH',
  'SHOCK_REVEAL',
  'DIRECT_VALUE',
  'CONTROVERSIAL_QUESTION',
  'STORY_CLIFFHANGER',
]);
export type HookMutationStrategy = z.infer<typeof HookMutationStrategySchema>;

export const HookMetadataTransformSchema = z.object({
  removeWatermarkMarkers: z.boolean().default(true),
  stripExifMetadata: z.boolean().default(true),
  normalizeAudioLufs: z.number().default(-14.0),
  targetPacingWpm: z.number().int().min(100).max(300).default(185),
});
export type HookMetadataTransform = z.infer<typeof HookMetadataTransformSchema>;

export const HookMutationRequestSchema = z.object({
  mutationId: z.string().min(1),
  videoId: z.string().min(1),
  sourcePlatform: SupportedPlatformSchema,
  targetPlatform: SupportedPlatformSchema,
  originalHookText: z.string().min(1),
  mutatedHookText: z.string().min(1).optional(),
  divergenceScore: z.number().min(0).max(1).optional(),
  strategy: HookMutationStrategySchema,
  metadataTransform: HookMetadataTransformSchema,
});
export type HookMutationRequest = z.infer<typeof HookMutationRequestSchema>;

// ============================================================================
// 4. Compute Job Arbitrage Spec
// ============================================================================

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

// ============================================================================
// 5. Arbitrage Decision
// ============================================================================

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
