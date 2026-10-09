/**
 * Seed Layer: Growth Triad v15 Type Definitions & Schemas
 * Type definitions for Closed-Loop Performance Feedback Ingestion,
 * Retention Normalization, and Multi-Objective Prior Optimization.
 * Layer: seed/types | Max LOC: < 200 | Zero :any
 * @module seed/types/growth-triad-v15
 */

import { z } from 'zod';

export const AudienceRetentionCurveSchema = z.object({
  timePct: z.number().min(0).max(100),
  retentionPct: z.number().min(0).max(100),
});
export type AudienceRetentionCurvePoint = z.infer<typeof AudienceRetentionCurveSchema>;

export const PostPublishFeedbackSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  videoManifestId: z.string().min(1),
  channelId: z.string().min(1),
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK', 'INSTAGRAM_REELS', 'FACEBOOK_REELS']),
  views: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative().optional(),
  watchTimeSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  retentionCurve: z.array(AudienceRetentionCurveSchema).min(2),
  ctr: z.number().min(0).max(1).optional(),
  viralityScore: z.number().min(0).max(100).optional(),
  collectedAt: z.number().int().positive(),
});
export type PostPublishFeedback = z.infer<typeof PostPublishFeedbackSchema>;

export interface RetentionIntegralResult {
  integratedRetentionPct: number;
  normalizedCompletionScore: number;
  hookDropoffRate: number;
  bodySlope: number;
}

export interface ConjugatePriorUpdateInput {
  currentAlpha: number;
  currentBeta: number;
  sampleSize: number;
  observedScore: number;
  dampeningFactor?: number;
}

export interface ConjugatePriorUpdateResult {
  updatedAlpha: number;
  updatedBeta: number;
  expectedValue: number;
  variance: number;
}

export interface BayesianFeedbackSummary {
  totalFeedbacksIngested: number;
  averageNormalizedRetention: number;
  highPerformersIdentified: number;
  lastUpdated: number;
}
