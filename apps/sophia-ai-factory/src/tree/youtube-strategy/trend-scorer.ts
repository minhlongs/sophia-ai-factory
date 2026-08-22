/**
 * Trend scoring with view count, seasonal multipliers, audience multipliers.
 * Pure business logic for YouTube trend analysis.
 */

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

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were',
  'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now',
]);

const SEASONAL_KEYWORDS: Record<string, readonly string[]> = {
  winter: ['christmas', 'holiday', 'new year', 'winter', 'snow', 'holiday gift'],
  spring: ['spring', 'easter', 'garden', 'renewal', 'cleanup'],
  summer: ['summer', 'vacation', 'beach', 'travel', 'outdoor', 'road trip'],
  fall: ['halloween', 'thanksgiving', 'autumn', 'back to school', 'fall'],
};

const AUDIENCE_MULTIPLIERS: Record<string, number> = {
  tech: 1.2,
  business: 1.1,
  education: 1.0,
  entertainment: 1.3,
  lifestyle: 1.15,
  general: 1.0,
};

const CATEGORIES: Record<string, readonly string[]> = {
  tech: ['technology', 'software', 'hardware', 'gadget', 'computer', 'phone', 'app', 'ai', 'code'],
  business: ['business', 'entrepreneur', 'startup', 'money', 'finance', 'invest', 'marketing'],
  education: ['learn', 'tutorial', 'how to', 'guide', 'course', 'study'],
  lifestyle: ['life', 'health', 'fitness', 'food', 'travel', 'fashion'],
  entertainment: ['fun', 'comedy', 'entertainment', 'funny'],
};

/**
 * Extract meaningful keywords from text, filtering stopwords and short words.
 */
export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

/**
 * Calculate seasonal relevance multiplier for a topic.
 */
export function getSeasonalMultiplier(topic: string): number {
  const month = new Date().getMonth();
  const season = month < 3 ? 'winter' : month < 6 ? 'spring' : month < 9 ? 'summer' : 'fall';
  const keywords = SEASONAL_KEYWORDS[season] ?? [];
  const topicLower = topic.toLowerCase();
  return keywords.some((kw) => topicLower.includes(kw)) ? 1.5 : 1.0;
}

/**
 * Calculate audience size multiplier based on topic category.
 */
export function getAudienceMultiplier(topic: string): number {
  const topicLower = topic.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some((kw) => topicLower.includes(kw))) {
      return AUDIENCE_MULTIPLIERS[category] ?? 1.0;
    }
  }
  return 1.0;
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
