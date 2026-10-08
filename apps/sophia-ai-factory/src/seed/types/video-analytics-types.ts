/**
 * Video Analytics & Net ROI Attribution Type Definitions
 * Layer: seed (foundational primitives & math schemas) | LOC: < 200 | Zero :any
 * @module seed/types/video-analytics-types
 */

import { z } from 'zod';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';

export type { SocialPlatform };

export interface PlatformRawMetrics {
  views: number;
  watchTimeSeconds: number;
  avgViewDurationSeconds: number;
  avgViewPercentage: number;
  threeSecViews?: number;
  firstQuartileViews?: number;
  completionCount?: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  durationSeconds?: number;
}

export interface NormalizedVideoMetrics {
  hookScore: number;
  retentionScore: number;
  threeSecViewRate: number;
  firstQuartileRate: number;
  completionRate: number;
  avgViewPercentage: number;
  engagementRate: number;
}

export interface VideoFinancialAttribution {
  mcuCost: number;
  mcuCostUsd: number;
  byokCostUsd: number;
  totalCostUsd: number;
  revenueUsd: number;
  netMarginUsd: number;
  roiPercent: number;
  roiPerMcu: number;
}

export type BanditArmLifecycle = 'COLD_START' | 'EXPLORING' | 'EXPLOITING' | 'PROMOTED' | 'WINNING_ARM' | 'ACTIVE_ARM';

export interface BanditArmTelemetry {
  armId: string;
  hookAngle: string;
  niche: string;
  alpha: number;
  beta: number;
  winRate: number;
  ctr: number;
  status: BanditArmLifecycle;
}

export interface VideoAnalyticsSnapshot {
  id: string;
  jobId: string;
  userId: string;
  channelId: string;
  platform: SocialPlatform;
  platformPostId: string;
  title?: string;
  views: number;
  watchTimeSeconds: number;
  avgViewDurationSeconds: number;
  avgViewPercentage: number;
  threeSecViewRate: number;
  completionRate: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  hookScore: number;
  retentionScore: number;
  revenueUsd: number;
  costMcu: number;
  costUsd: number;
  netRoiUsd: number;
  banditStatus?: BanditArmLifecycle;
  recordedAt: number;
  createdAt: number;
}

export interface ChannelAggregateMetrics {
  totalViews: number;
  totalRevenueUsd: number;
  totalCostUsd: number;
  totalNetMarginUsd: number;
  avgHookScore: number;
  avgRetentionScore: number;
  roiPercent: number;
  publishedCount: number;
}

export const analyticsQueryFilterSchema = z.object({
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']).optional(),
  channelId: z.string().optional(),
  startDate: z.number().optional(),
  endDate: z.number().optional(),
  limit: z.number().min(1).max(100).default(50).optional(),
  offset: z.number().min(0).default(0).optional(),
});

export type AnalyticsQueryFilter = z.infer<typeof analyticsQueryFilterSchema>;
