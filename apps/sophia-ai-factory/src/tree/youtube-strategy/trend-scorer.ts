/**
 * Trend scoring with view count, seasonal multipliers, audience multipliers.
 * Pure business logic for YouTube trend analysis.
 */

import {
  extractKeywords,
  getSeasonalMultiplier,
  getAudienceMultiplier,
} from './trend-scorer-constants';

export { extractKeywords, getSeasonalMultiplier, getAudienceMultiplier };

export interface TrendItem {
  readonly videoId: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly viewCount: number;
  readonly category: string | number;
  readonly publishedAt: string;
  readonly publisher: string;
  readonly url: string;
}

export interface ScoredTopic {
  readonly topic: string;
  readonly score: number;
  readonly finalScore: number;
  readonly sources: readonly string[];
  readonly evidence: readonly TrendEvidence[];
}

export interface TrendEvidence {
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly publishedAt: string;
  readonly sourceType: string;
}

/**
 * Score individual trending items by view count (normalized by millions).
 */
export function scoreTrendItem(item: TrendItem): number {
  return item.viewCount / 1_000_000;
}

/**
 * Merge trend data and competitor insights into ranked topics.
 * Deduplicates evidence by URL, caps at 50 results.
 */
export function mergeTrendData(
  trends: readonly TrendItem[],
  competitors: readonly {
    readonly topPerformingTopics: ReadonlyArray<{
      readonly topic: string;
      readonly avgViews: number;
      readonly evidence?: readonly TrendEvidence[];
    }>;
  }[],
): ScoredTopic[] {
  const mergedTopics = new Map<string, { score: number; sources: string[]; evidence: TrendEvidence[] }>();

  for (const trend of trends) {
    const keywords = extractKeywords(trend.title);
    for (const keyword of keywords) {
      if (!mergedTopics.has(keyword)) {
        mergedTopics.set(keyword, { score: 0, sources: [], evidence: [] });
      }
      const topic = mergedTopics.get(keyword)!;
      topic.score += scoreTrendItem(trend);
      topic.sources.push('trending');
      topic.evidence.push({
        url: trend.url,
        title: trend.title,
        publisher: trend.publisher,
        publishedAt: trend.publishedAt,
        sourceType: 'video',
      });
    }
  }

  for (const competitor of competitors) {
    for (const { topic, avgViews, evidence = [] } of competitor.topPerformingTopics) {
      if (!mergedTopics.has(topic)) {
        mergedTopics.set(topic, { score: 0, sources: [], evidence: [] });
      }
      const topicData = mergedTopics.get(topic)!;
      topicData.score += avgViews / 100_000;
      topicData.sources.push('competitor');
      topicData.evidence.push(...evidence);
    }
  }

  return Array.from(mergedTopics.entries())
    .map(([topic, data]) => ({
      topic,
      score: data.score,
      finalScore: data.score * getSeasonalMultiplier(topic) * getAudienceMultiplier(topic),
      sources: [...new Set(data.sources)],
      evidence: dedupeByUrls(data.evidence).slice(0, 5),
    }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 50);
}

function dedupeByUrls(items: readonly TrendEvidence[]): TrendEvidence[] {
  return [...new Map(items.filter((s) => s.url).map((s) => [s.url, s])).values()];
}
