/**
 * Social Analytics Platform Metrics Fetcher & Types
 * Layer: forest/inngest/functions
 * @module forest/inngest/functions/social-analytics-metrics-fetcher
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import type { PlatformRawMetrics } from '@/seed/types/video-analytics-types';

export interface AnalyticsSyncPayload {
  userId: string;
  jobId: string;
  channelId: string;
  platform: SocialPlatform;
  platformPostId: string;
  title?: string;
  mcuCost: number;
  byokCostUsd?: number;
  revenueUsd?: number;
}

export async function fetchMockPlatformMetrics(
  platform: SocialPlatform,
  _postId: string,
): Promise<PlatformRawMetrics> {
  const allowed = await shouldAllowRequest(`analytics_${platform}`);
  if (!allowed) {
    throw new Error(`Circuit breaker open for ${platform} analytics`);
  }

  try {
    // Platform API adapter logic (YouTube Analytics, TikTok Business API, Meta Graph)
    const views = Math.floor(Math.random() * 5000) + 100;
    const watchTime = views * (15 + Math.random() * 20);
    const avgPct = 60 + Math.random() * 45; // Up to 105% with loops
    const metrics: PlatformRawMetrics = {
      views,
      watchTimeSeconds: Math.round(watchTime),
      avgViewDurationSeconds: Math.round(watchTime / views),
      avgViewPercentage: Math.round(avgPct * 10) / 10,
      threeSecViews: Math.round(views * (0.65 + Math.random() * 0.25)),
      firstQuartileViews: Math.round(views * (0.50 + Math.random() * 0.25)),
      completionCount: Math.round(views * (0.35 + Math.random() * 0.30)),
      likes: Math.round(views * 0.08),
      comments: Math.round(views * 0.015),
      shares: Math.round(views * 0.02),
      saves: Math.round(views * 0.03),
    };
    await recordSuccess(`analytics_${platform}`);
    return metrics;
  } catch (err: unknown) {
    await recordFailure(`analytics_${platform}`, FailureKind.SERVER_ERROR);
    throw err;
  }
}
