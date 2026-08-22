/**
 * Tag generation and prioritization for YouTube videos.
 * Focused module split from seo-optimizer.
 */

export interface TagInput {
  readonly topic: string;
  readonly contentType: string;
  readonly keywords: readonly string[];
  readonly channelName?: string;
}

const CONTENT_TYPE_TAG_MAP: Record<string, readonly string[]> = {
  Tutorial: ['how to', 'tutorial', 'guide', 'step by step', 'learn'],
  Explainer: ['explained', 'what is', 'understanding', 'explanation'],
  Review: ['review', 'comparison', 'vs', 'best', 'top'],
  List: ['top 10', 'best', 'list', 'countdown'],
  Story: ['story', 'journey', 'experience', 'case study'],
};

const NICHE_TAG_MAP: Record<string, readonly string[]> = {
  technology: ['tech', 'technology', 'innovation', 'future tech'],
  gaming: ['gaming', 'gameplay', 'walkthrough'],
  education: ['educational', 'learning', 'study tips'],
  business: ['business tips', 'entrepreneurship', 'startup'],
  lifestyle: ['lifestyle', 'life hacks', 'productivity'],
  health: ['health tips', 'fitness', 'wellness'],
  entertainment: ['entertainment', 'viral', 'trending'],
  general: ['video', 'youtube', 'content'],
};

const NICHE_KEYWORDS: Record<string, readonly string[]> = {
  technology: ['tech', 'software', 'hardware', 'gadget', 'computer', 'phone', 'app'],
  gaming: ['game', 'gaming', 'gamer', 'play', 'stream'],
  education: ['learn', 'study', 'course', 'tutorial', 'education'],
  business: ['business', 'entrepreneur', 'startup', 'money', 'finance'],
  lifestyle: ['life', 'lifestyle', 'daily', 'routine'],
  health: ['health', 'fitness', 'workout', 'diet', 'nutrition'],
  entertainment: ['fun', 'comedy', 'entertainment', 'funny'],
};

/**
 * Generate prioritized tags that fit within YouTube's 500-char limit.
 */
export function generatePrioritizedTags(input: TagInput): string[] {
  const candidates = new Set<string>();

  for (const kw of input.keywords) candidates.add(kw);
  candidates.add(input.topic.toLowerCase());

  const typeTags = CONTENT_TYPE_TAG_MAP[input.contentType] ?? [];
  for (const t of typeTags) candidates.add(t);

  const year = new Date().getFullYear().toString();
  candidates.add(year);
  candidates.add(`${input.topic.toLowerCase()} ${year}`);

  const niche = identifyNiche(input.topic);
  for (const t of NICHE_TAG_MAP[niche] ?? NICHE_TAG_MAP.general) candidates.add(t);

  for (const lt of longTailVariants(input.topic)) candidates.add(lt);

  if (input.channelName) candidates.add(input.channelName);

  return enforceCharLimit(prioritizeByRelevance([...candidates], input), 500);
}

/**
 * Score a tag string by its relevance to the primary topic/keywords.
 */
export function scoreTag(tag: string, primaryKeyword: string, keywords: readonly string[]): number {
  let score = 0;
  if (tag === primaryKeyword) score += 10;
  if (keywords.includes(tag)) score += 5;
  if (tag.includes(primaryKeyword.toLowerCase())) score += 3;
  if (tag.split(' ').length > 2) score += 2;
  if (tag.includes(new Date().getFullYear().toString())) score += 1;
  return score;
}

/**
 * Enforce a character limit across a list of tags.
 */
export function enforceCharLimit(tags: string[], maxChars: number): string[] {
  let total = 0;
  const result: string[] = [];
  for (const tag of tags) {
    if (total + tag.length + 1 > maxChars) break;
    result.push(tag);
    total += tag.length + 1;
  }
  return result;
}

function identifyNiche(topic: string): string {
  const t = topic.toLowerCase();
  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    if (keywords.some((kw) => t.includes(kw))) return niche;
  }
  return 'general';
}

function longTailVariants(topic: string): string[] {
  const year = new Date().getFullYear().toString();
  return [
    `how to ${topic}`,
    `${topic} for beginners`,
    `${topic} tutorial`,
    `${topic} guide ${year}`,
    `${topic} mistakes to avoid`,
  ];
}

function prioritizeByRelevance(tags: string[], input: TagInput): string[] {
  const primary = input.keywords[0] ?? '';
  const scored = tags.map((tag) => ({ tag, score: scoreTag(tag, primary, input.keywords) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.tag);
}
