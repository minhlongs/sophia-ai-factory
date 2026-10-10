/**
 * Tag & Keyword Analyzer for YouTube SEO
 *
 * @module tree/youtube-strategy/seo/keyword-analyzer
 */

import {
  CONTENT_TYPE_TAGS,
  NICHE_HASHTAGS,
  NICHE_KEYWORDS,
  NICHE_TAGS,
  type SEOOptimizationInput,
} from './types';

export function identifyNiche(topic: string): string {
  const topicLower = topic.toLowerCase();
  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    if (keywords.some((kw) => topicLower.includes(kw))) return niche;
  }
  return 'general';
}

export function generateLongTailKeywords(topic: string): string[] {
  return [
    `how to ${topic}`,
    `${topic} for beginners`,
    `${topic} tutorial`,
    `best ${topic}`,
    `${topic} tips and tricks`,
  ].slice(0, 5);
}

export function prioritizeTags(tags: string[], input: SEOOptimizationInput): string[] {
  const scored = tags.map((tag) => {
    let score = 0;
    if (tag === input.keywords[0]) score += 10;
    if (input.keywords.includes(tag)) score += 5;
    if (tag.includes(input.topic.toLowerCase())) score += 3;
    if (tag.split(' ').length > 2) score += 2;
    if (tag.includes(new Date().getFullYear().toString())) score += 1;
    return { tag, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.tag);
}

/**
 * Generate tags with prioritization, respecting YouTube's 500-char limit.
 */
export function generateTags(input: SEOOptimizationInput): string[] {
  const tags = new Set<string>();
  for (const kw of input.keywords) tags.add(kw);

  const topicLower = input.topic.toLowerCase();
  tags.add(topicLower);

  const typeTags = CONTENT_TYPE_TAGS[input.contentType] ?? [];
  for (const t of typeTags) tags.add(t);

  const year = new Date().getFullYear().toString();
  tags.add(year);
  tags.add(`${topicLower} ${year}`);

  const niche = identifyNiche(input.topic);
  for (const t of NICHE_TAGS[niche] ?? NICHE_TAGS.general) tags.add(t);

  for (const kw of generateLongTailKeywords(input.topic)) tags.add(kw);

  const prioritized = prioritizeTags([...tags], input);
  let totalLength = 0;
  const result: string[] = [];
  for (const tag of prioritized) {
    if (totalLength + tag.length + 1 > 500) break;
    result.push(tag);
    totalLength += tag.length + 1;
  }
  return result;
}

/**
 * Generate hashtags for YouTube video.
 */
export function generateHashtags(input: SEOOptimizationInput): string[] {
  const hashtags: string[] = [];
  hashtags.push(`#${input.topic.replace(/\s+/g, '')}`);
  hashtags.push(`#${input.contentType.toLowerCase()}`);

  const niche = identifyNiche(input.topic);
  const nicheHashtags = NICHE_HASHTAGS[niche] ?? [];
  hashtags.push(...nicheHashtags.slice(0, 2));

  hashtags.push('#youtube', '#youtuber', '#subscribe');
  hashtags.push(`#${new Date().getFullYear()}`);

  return hashtags.slice(0, 15);
}
