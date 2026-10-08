/**
 * @file growth-triad-v8-types.ts
 * @description Seed Layer type definitions and Zod schemas for Growth Triad v8
 * @layer seed
 */

import { z } from 'zod';

// ============================================================================
// Pillar 1: Multi-Platform Audio & Beat-Drop Resonance Engine
// ============================================================================

export const AudioBeatInputSchema = z.object({
  audioTrackId: z.string().min(1),
  bpm: z.number().positive(),
  durationSec: z.number().positive(),
  beatTimestampsSec: z.array(z.number().nonnegative()),
  arousalScore: z.number().min(0).max(1),
  valenceScore: z.number().min(0).max(1),
  candidateCutTimestampsSec: z.array(z.number().nonnegative()),
});
export type AudioBeatInput = z.infer<typeof AudioBeatInputSchema>;

export const AudioDuckingMarkerSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  targetDuckingDb: z.number().negative(),
});
export type AudioDuckingMarker = z.infer<typeof AudioDuckingMarkerSchema>;

export const AudioResonanceOutputSchema = z.object({
  audioTrackId: z.string(),
  resonanceScore: z.number().min(0).max(100),
  quantizedCutTimestampsSec: z.array(z.number().nonnegative()),
  duckingMarkers: z.array(AudioDuckingMarkerSchema),
  syncQuality: z.enum(['PERFECT', 'HIGH', 'FAIR']),
});
export type AudioResonanceOutput = z.infer<typeof AudioResonanceOutputSchema>;

// ============================================================================
// Pillar 2: Autonomous Community Comment Sentiment & Viral Bait Catalyst
// ============================================================================

export const CommunityBaitInputSchema = z.object({
  videoId: z.string().min(1),
  videoTopic: z.string().min(1),
  sentimentPolarityScore: z.number().min(0).max(1),
  targetAudienceType: z.enum(['ENTREPRENEUR', 'DEVELOPER', 'STUDENT', 'GENERAL']),
});
export type CommunityBaitInput = z.infer<typeof CommunityBaitInputSchema>;

export const ViralDiscussionHookSchema = z.object({
  hookQuestion: z.string(),
  curiosityGapScore: z.number().min(0).max(1),
  estimatedCommentVelocity: z.number().positive(),
  brandSafetyPassed: z.boolean(),
});
export type ViralDiscussionHook = z.infer<typeof ViralDiscussionHookSchema>;

export const CommunityBaitCampaignSchema = z.object({
  campaignId: z.string(),
  videoId: z.string(),
  primaryHook: ViralDiscussionHookSchema,
  alternativeHooks: z.array(ViralDiscussionHookSchema),
});
export type CommunityBaitCampaign = z.infer<typeof CommunityBaitCampaignSchema>;

// ============================================================================
// Pillar 3: Predictive Subscriber Cohort Lifetime Value (LTV) & Hazard Decay Engine
// ============================================================================

export const SubscriberCohortInputSchema = z.object({
  cohortMonth: z.string().regex(/^\d{4}-\d{2}$/),
  initialSubscribers: z.number().int().positive(),
  monthlySubscriptionPriceUsd: z.number().positive(),
  weibullScaleLambda: z.number().positive(),
  weibullShapeBeta: z.number().positive(),
  projectionMonths: z.number().int().positive().default(12),
});
export type SubscriberCohortInput = z.infer<typeof SubscriberCohortInputSchema>;

export const MonthlyCohortSurvivalPointSchema = z.object({
  monthIndex: z.number().int().nonnegative(),
  survivalProbability: z.number().min(0).max(1),
  activeSubscribers: z.number().int().nonnegative(),
  projectedRevenueUsd: z.number().nonnegative(),
  hazardRate: z.number().nonnegative(),
});
export type MonthlyCohortSurvivalPoint = z.infer<typeof MonthlyCohortSurvivalPointSchema>;

export const CohortLtvReportSchema = z.object({
  cohortMonth: z.string(),
  cumulativeLtvUsd: z.number().nonnegative(),
  churnHazardPeakMonth: z.number().int().positive(),
  recommendedAction: z.string(),
  survivalCurve: z.array(MonthlyCohortSurvivalPointSchema),
});
export type CohortLtvReport = z.infer<typeof CohortLtvReportSchema>;
