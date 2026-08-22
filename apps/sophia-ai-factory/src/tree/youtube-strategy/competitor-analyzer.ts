/**
 * Competitor channel analysis logic.
 * Pure TypeScript — analyzes channel performance patterns.
 */

import { extractKeywords, type TrendEvidence } from './trend-scorer';

export interface CompetitorChannel {
  readonly channelId: string;
  readonly topPerformingTopics: readonly TopicPerformance[];
  readonly averageViews: number;
  readonly uploadFrequency: number;
}

export interface TopicPerformance {
  readonly topic: string;
  readonly avgViews: number;
  readonly evidence: readonly TrendEvidence[];
}

export interface VideoSnippet {
  readonly id: string;
  readonly snippet: {
    readonly title: string;
    readonly channelTitle?: string;
    readonly publishedAt?: string;
  };
  readonly statistics?: {
    readonly viewCount?: string | number;
  };
}

/**
 * Analyze video performance for a competitor channel.
 * Extracts top topics, average views, and upload frequency.
 */
export function analyzeVideoPerformance(videos: readonly VideoSnippet[]): {
  topTopics: readonly TopicPerformance[];
  avgViews: number;
  frequency: number;
} {
  if (!videos || videos.length === 0) {
    return { topTopics: [], avgViews: 0, frequency: 0 };
  }

  const topics = new Map<string, { count: number; views: number; evidence: TrendEvidence[] }>();
  let totalViews = 0;

  for (const video of videos) {
    const title = video.snippet.title.toLowerCase();
    const views = Number(video.statistics?.viewCount ?? 0);
    totalViews += views;
    const keywords = extractKeywords(title);

    for (const keyword of keywords) {
      if (!topics.has(keyword)) {
        topics.set(keyword, { count: 0, views: 0, evidence: [] });
      }
      const entry = topics.get(keyword)!;
      entry.count++;
      entry.views += views;
      entry.evidence.push({
        url: `https://www.youtube.com/watch?v=${video.id}`,
        title: video.snippet.title,
        publisher: video.snippet.channelTitle ?? 'Unknown',
        publishedAt: video.snippet.publishedAt ?? '',
        sourceType: 'video',
      });
    }
  }

  const topTopics: TopicPerformance[] = [...topics.entries()]
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 10)
    .map(([topic, data]) => ({
      topic,
      avgViews: data.views / data.count,
      evidence: data.evidence.slice(0, 5),
    }));

  return {
    topTopics,
    avgViews: totalViews / videos.length,
    frequency: videos.length,
  };
}

/**
 * Get competitor insights for a specific topic.
 */
export interface CompetitorInsightResult {
  readonly channelId: string;
  readonly averageViews: number;
  readonly relevantTopics: readonly TopicPerformance[];
}

export function getCompetitorInsights(
  competitorData: readonly CompetitorChannel[],
  topic: string,
): readonly CompetitorInsightResult[] {
  const topicLower = topic.toLowerCase();
  return competitorData
    .filter((c) =>
      c.topPerformingTopics.some((t) => t.topic.toLowerCase().includes(topicLower)),
    )
    .map((c) => ({
      channelId: c.channelId,
      averageViews: c.averageViews,
      relevantTopics: c.topPerformingTopics.filter((t) =>
        t.topic.toLowerCase().includes(topicLower),
      ),
    }));
}
