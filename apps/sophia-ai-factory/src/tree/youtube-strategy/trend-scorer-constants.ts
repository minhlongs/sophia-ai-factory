/**
 * Trend scoring lexicons, stopwords, seasonal keywords, and audience multipliers.
 */

export const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were',
  'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now',
]);

export const SEASONAL_KEYWORDS: Record<string, readonly string[]> = {
  winter: ['christmas', 'holiday', 'new year', 'winter', 'snow', 'holiday gift'],
  spring: ['spring', 'easter', 'garden', 'renewal', 'cleanup'],
  summer: ['summer', 'vacation', 'beach', 'travel', 'outdoor', 'road trip'],
  fall: ['halloween', 'thanksgiving', 'autumn', 'back to school', 'fall'],
};

export const AUDIENCE_MULTIPLIERS: Record<string, number> = {
  tech: 1.2,
  business: 1.1,
  education: 1.0,
  entertainment: 1.3,
  lifestyle: 1.15,
  general: 1.0,
};

export const CATEGORIES: Record<string, readonly string[]> = {
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
