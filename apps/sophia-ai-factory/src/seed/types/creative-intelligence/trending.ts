/**
 * Cross-Platform Trending Signal Contracts
 *
 * Layer: seed/types/creative-intelligence
 */

import { z } from 'zod';

export const TrendingPlatformSchema = z.enum(['tiktok', 'youtube_shorts', 'x']);
export type TrendingPlatform = z.infer<typeof TrendingPlatformSchema>;

export const TrendingSignalSchema = z.object({
  id: z.string(),
  platform: TrendingPlatformSchema,
  topic: z.string(),
  query: z.string(),
  title: z.string(),
  engagementMetrics: z.object({
    viewCount: z.number().optional(),
    likeCount: z.number().optional(),
    shareCount: z.number().optional(),
    commentCount: z.number().optional(),
    volume: z.number().optional(),
  }),
  velocityScore: z.number(),
  momentumScore: z.number(),
  viralScore: z.number().optional(),
  hashtags: z.array(z.string()),
  detectedAt: z.number(),
  rawData: z.record(z.string(), z.unknown()).optional(),
});
export type TrendingSignal = z.infer<typeof TrendingSignalSchema>;
