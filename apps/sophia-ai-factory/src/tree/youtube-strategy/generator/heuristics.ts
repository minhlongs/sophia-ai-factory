import {
  CONTENT_TYPES,
  ALLOWED_CONTENT_TYPES,
  EVERGREEN_FALLBACK_TOPICS,
  BEST_TIMES,
} from './constants';

/**
 * Extract keywords from a topic string.
 */
export function extractKeywordsFromTopic(topic: string): string[] {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was',
    'were', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'just', 'now',
  ]);
  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
}

/**
 * Select content type based on topic keywords.
 */
export function selectContentType(topic: string): string {
  const topicLower = topic.toLowerCase();
  for (const ct of CONTENT_TYPES) {
    if (ct.suitableFor.some((kw) => topicLower.includes(kw))) return ct.type;
  }
  return 'Explainer';
}

/**
 * Normalize a content type string to the allowed set.
 */
export function normalizeContentType(contentType: unknown, topic: string): string {
  const normalized = String(contentType ?? '').trim();
  const titleCased = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return ALLOWED_CONTENT_TYPES.has(titleCased as 'Tutorial' | 'Explainer' | 'List' | 'Review' | 'Story' | 'News')
    ? titleCased
    : selectContentType(topic);
}

/**
 * Select the best trending topic by score, filtering out single keywords.
 */
export function selectOptimalTopic(
  topics: ReadonlyArray<{ readonly topic: string; readonly finalScore: number }>,
): { topic: string; score: number } {
  const readable = topics.find((t) => t.topic.trim().includes(' ') && t.topic.trim().length >= 8);
  if (readable) return { topic: readable.topic, score: readable.finalScore };
  const fallback = EVERGREEN_FALLBACK_TOPICS[Math.floor(Math.random() * EVERGREEN_FALLBACK_TOPICS.length)];
  return { topic: fallback, score: 1 };
}

export function generateAngle(topic: string): string {
  const angles = [
    `The Ultimate Guide to ${topic}`,
    `${topic}: What Nobody Is Telling You`,
    `How ${topic} Will Change Everything in ${new Date().getFullYear()}`,
    `${topic} Explained in 5 Minutes`,
  ];
  return angles[Math.floor(Math.random() * angles.length)];
}

export function predictViews(_topic: string): number {
  const base = 5000;
  const variance = base * 0.3;
  return Math.floor(base + Math.random() * variance * 2 - variance);
}

export function calculateBestPublishTime(): string {
  const selected = BEST_TIMES[Math.floor(Math.random() * BEST_TIMES.length)];
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = days.indexOf(selected.day);
  const currentDay = now.getDay();
  const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  next.setHours(selected.hour, 0, 0, 0);
  return next.toISOString();
}
