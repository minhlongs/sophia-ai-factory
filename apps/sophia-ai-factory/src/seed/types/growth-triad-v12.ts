/**
 * Growth Triad v12 Type Definitions & Zod Schemas
 * Layer: seed/types | Max LOC: < 200 | Zero :any
 * @module seed/types/growth-triad-v12
 */

import { z } from 'zod';
import type { SocialPlatform } from './social-publisher-types';

export type VideoViralityClass = 'ALPHA_VIRAL' | 'STEADY' | 'STAGNANT';
export type ReseedJobStatus = 'PENDING' | 'RESEEDED' | 'SKIPPED' | 'FAILED';
export type AffiliateNetworkType = 'CLICKBANK' | 'PAYOS' | 'NOWPAYMENTS' | 'AWIN';
export type AttributionStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'REFUNDED';

export const videoRetentionProfileSchema = z.object({
  jobId: z.string().min(1),
  channelId: z.string().min(1),
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']),
  avgRetentionPercent: z.number().min(0).max(200),
  completionRatePercent: z.number().min(0).max(100),
  views: z.number().int().nonnegative(),
  durationSeconds: z.number().positive(),
});
export type VideoRetentionProfile = z.infer<typeof videoRetentionProfileSchema>;

export const channelBaselineMetricsSchema = z.object({
  channelId: z.string().min(1),
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']),
  meanRetentionPercent: z.number().positive(),
  stdDevRetentionPercent: z.number().positive(),
  sampleSize: z.number().int().positive(),
});
export type ChannelBaselineMetrics = z.infer<typeof channelBaselineMetricsSchema>;

export const reseedTriggerPayloadSchema = z.object({
  userId: z.string().min(1),
  sourceJobId: z.string().min(1),
  channelId: z.string().min(1),
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']),
  originalHook: z.string().min(5),
  retentionZScore: z.number(),
  classification: z.enum(['ALPHA_VIRAL', 'STEADY', 'STAGNANT']),
  mutatedHooks: z.array(z.string().min(5)).min(1).max(5),
});
export type ReseedTriggerPayload = z.infer<typeof reseedTriggerPayloadSchema>;

export const incomingConversionWebhookSchema = z.object({
  network: z.enum(['CLICKBANK', 'PAYOS', 'NOWPAYMENTS', 'AWIN']),
  externalOrderId: z.string().min(1),
  videoManifestId: z.string().min(1),
  userId: z.string().min(1),
  grossAmountUsd: z.number().nonnegative(),
  commissionAmountUsd: z.number().nonnegative(),
  currency: z.string().default('USD'),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
});
export type IncomingConversionWebhook = z.infer<typeof incomingConversionWebhookSchema>;

export const affiliateConversionWebhookSchema = z.object({
  affiliateNetwork: z.enum(['CLICKBANK', 'PAYOS', 'NOWPAYMENTS', 'AWIN']),
  externalOrderId: z.string().min(1),
  grossAmountUsd: z.number().nonnegative(),
  commissionAmountUsd: z.number().nonnegative(),
  subId: z.string().optional(),
  currency: z.string().default('USD'),
  rawPayload: z.string().optional(),
});
export type AffiliateConversionWebhook = z.infer<typeof affiliateConversionWebhookSchema>;

export interface FlywheelSummaryStats {
  totalReseedJobs: number;
  alphaViralDetected: number;
  reseededCount: number;
  totalAttributedRevenueUsd: number;
  totalCommissionUsd: number;
}
