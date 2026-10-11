/**
 * YouTube Signal Normalizer & Parser
 * Layer: tree (domain reusable)
 */

import type { MarketSignal } from '@/seed/types/creative-domain';
import { createMarketSignalId } from '@/seed/types/creative-economy/ids';
import { YouTubeVideoItem, YOUTUBE_CATEGORY_NAMES } from './types';

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Normalize YouTube video to MarketSignal(type='trend').
 * Confidence derived from view velocity (views per hour since publish).
 */
export function normalizeVideoToSignal(
  video: YouTubeVideoItem,
  workspaceId: string,
  regionCode: string
): MarketSignal {
  const viewCount = parseInt(video.statistics.viewCount, 10) || 0;
  const likeCount = parseInt(video.statistics.likeCount ?? '0', 10) || 0;
  const commentCount = parseInt(video.statistics.commentCount ?? '0', 10) || 0;

  // Calculate view velocity (views per hour)
  const publishedAt = new Date(video.snippet.publishedAt).getTime();
  const hoursSincePublish = Math.max(1, (Date.now() - publishedAt) / (1000 * 60 * 60));
  const viewVelocity = viewCount / hoursSincePublish;

  // Confidence: 0-1 based on view velocity (capped at 1M views/hour = 1.0)
  const confidence = Math.min(1, viewVelocity / 1_000_000);

  // Relevance: engagement rate (likes + comments) / views
  const engagementRate = viewCount > 0 ? (likeCount + commentCount) / viewCount : 0;
  const relevanceScore = Math.min(1, engagementRate * 100); // Scale for readability

  const categoryName = YOUTUBE_CATEGORY_NAMES[video.snippet.categoryId] ?? 'Unknown';

  return {
    id: createMarketSignalId(),
    workspaceId,
    type: 'trend',
    source: 'youtube',
    title: video.snippet.title,
    summary: truncate(video.snippet.description, 500),
    data: {
      videoId: video.id,
      channelTitle: video.snippet.channelTitle,
      categoryId: video.snippet.categoryId,
      categoryName,
      regionCode,
      viewCount,
      likeCount,
      commentCount,
      viewVelocity,
      publishedAt: video.snippet.publishedAt,
      videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
      tags: video.snippet.tags ?? [],
    },
    confidence,
    relevanceScore,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    consumed: false,
    createdAt: Date.now(),
  };
}
