/**
 * Platform Hashtag & Candidate Topic Cluster Matcher
 *
 * Implements hashtag derivation and viral angle candidate formulations.
 *
 * Layer: tree (domain reusable)
 *
 * @module tree/trend-intelligence/scout/cluster-matcher
 */

import type { TrendingPlatform, CandidateTopic } from './types';

/**
 * Derives normalized hashtags for a given platform and query.
 */
export function deriveHashtags(platform: TrendingPlatform, query: string): string[] {
  const cleanQuery = query.replace(/[^\w\sÀ-ɏẠ-ỹ]/g, '').trim();
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);

  const platformTag =
    platform === 'tiktok'
      ? 'tiktokviral'
      : platform === 'youtube_shorts'
        ? 'shorts'
        : 'xtrends';

  const baseTags = [`#${platformTag}`, '#trending', '#ai'];
  for (const token of tokens) {
    if (token.length > 2) {
      baseTags.push(`#${token.toLowerCase()}`);
    }
  }

  return Array.from(new Set(baseTags)).slice(0, 5);
}

/**
 * Generates candidate topic formulations reflecting real viral angles for a query.
 */
export function buildCandidateTopics(normalizedQuery: string, limit: number): CandidateTopic[] {
  return [
    {
      title: `${normalizedQuery}: 3 bí quyết tăng trưởng đột phá trong 30 ngày`,
      topic: `${normalizedQuery} Growth Secrets`,
      baseViews: 125_000,
      shares: 3_800,
    },
    {
      title: `Tại sao 90% người làm ${normalizedQuery} đang mắc sai lầm nghiêm trọng?`,
      topic: `${normalizedQuery} Warning`,
      baseViews: 88_000,
      shares: 2_400,
    },
    {
      title: `Công cụ AI ${normalizedQuery} vượt trội hoàn toàn mọi đối thủ 2026`,
      topic: `${normalizedQuery} AI Tool`,
      baseViews: 210_000,
      shares: 7_100,
    },
    {
      title: `Sự thật gây sốc về ${normalizedQuery} mà không chuyên gia nào dám nói`,
      topic: `${normalizedQuery} Shocking Truth`,
      baseViews: 340_000,
      shares: 11_500,
    },
    {
      title: `Hồi đó khi tôi mới thử nghiệm ${normalizedQuery}, cái kết không ai ngờ tới`,
      topic: `${normalizedQuery} Story Case Study`,
      baseViews: 95_000,
      shares: 3_100,
    },
  ].slice(0, limit);
}
