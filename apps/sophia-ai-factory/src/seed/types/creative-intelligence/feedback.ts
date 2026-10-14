/**
 * Closed-Loop Viral Feedback Contracts
 *
 * Layer: seed/types/creative-intelligence
 */

import { z } from 'zod';
import { HookStyleSchema } from './hooks';

export const VideoEngagementFeedbackSchema = z.object({
  videoId: z.string().min(1, 'videoId is required'),
  workspaceId: z.string().optional(),
  missionId: z.string().optional(),
  platform: z.enum(['tiktok', 'youtube_shorts', 'x', 'instagram_reels']).or(z.string()),
  hookStyle: HookStyleSchema.optional(),
  voiceStyle: z.string().optional(),
  durationSeconds: z.number().positive().optional(),
  totalDurationSeconds: z.number().positive().optional(),
  views: z.number().nonnegative().optional(),
  shares: z.number().nonnegative().optional(),
  watchTimeSeconds: z.number().nonnegative().optional(),
  completionRate: z.number().min(0).max(1).optional(),
  likes: z.number().nonnegative().optional(),
  comments: z.number().nonnegative().optional(),
  clicks: z.number().nonnegative().optional(),
  impressions: z.number().nonnegative().optional(),
  conversions: z.number().nonnegative().optional(),
  spendCents: z.number().nonnegative().optional(),
  revenueCents: z.number().nonnegative().optional(),
  recordedAt: z.number().optional(),
  syncedAt: z.number().optional(),
  features: z
    .object({
      hookStyle: HookStyleSchema.optional(),
      voiceProfile: z.string().optional(),
      durationPattern: z.string().optional(),
      aspectRatio: z.enum(['9:16', '16:9', '1:1']).optional(),
      channel: z.string().optional(),
    })
    .optional(),
  metrics: z
    .object({
      views: z.number().nonnegative(),
      shares: z.number().nonnegative(),
      watchTimeSeconds: z.number().nonnegative(),
      averageWatchPercent: z.number().optional(),
      completionRate: z.number().min(0).max(1).optional(),
    })
    .optional(),
});
export type VideoEngagementFeedback = z.infer<typeof VideoEngagementFeedbackSchema>;

export const PatternUpdateDetailSchema = z.object({
  patternId: z.string(),
  featureKey: z.string(),
  featureValue: z.string(),
  previousAvg: z.number(),
  newAvg: z.number(),
  sampleSize: z.number(),
  retries: z.number(),
  status: z.enum(['updated', 'created', 'conflict_exhausted']),
});
export type PatternUpdateDetail = z.infer<typeof PatternUpdateDetailSchema>;

export const PatternUpdateResultSchema = z.object({
  patternId: z.string().optional(),
  videoId: z.string().optional(),
  previousScore: z.number().optional(),
  newScore: z.number().optional(),
  cesScore: z.number().optional(),
  sampleCount: z.number().optional(),
  sampleSize: z.number().optional(),
  confidence: z.number().min(0).max(1),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  updatedAt: z.number().optional(),
  casApplied: z.boolean().optional(),
  updatedPatterns: z.array(PatternUpdateDetailSchema).optional(),
  errors: z.array(z.string()).optional(),
  resolvedProvider: z.string().optional(),
  providerDiverted: z.boolean().optional(),
});
export type PatternUpdateResult = z.infer<typeof PatternUpdateResultSchema>;
