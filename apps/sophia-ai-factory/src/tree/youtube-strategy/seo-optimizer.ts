/**
 * YouTube SEO optimization — title, description, tags, hashtags, chapters, scoring.
 * Ported from Lumen's seo-optimizer-agent.
 */


export interface SEOOptimizationInput {
  readonly title: string;
  readonly topic: string;
  readonly angle: string;
  readonly contentType: string;
  readonly targetAudience: string;
  readonly keywords: readonly string[];
}

export interface ScriptSection {
  readonly title: string;
  readonly duration: number;
}

export interface ScriptForSEO {
  readonly title: string;
  readonly mainContent?: { readonly sections: readonly ScriptSection[] };
}

export interface SEOResult {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly hashtags: readonly string[];
  readonly chapters: readonly ChapterEntry[];
  readonly seoScore: number;
}

export interface ChapterEntry {
  readonly time: string;
  readonly title: string;
  readonly seconds: number;
}

const POWER_WORDS = ['Ultimate', 'Complete', 'Essential', 'Proven', 'Secret', 'Amazing', 'Powerful'];

const NICHE_KEYWORDS: Record<string, readonly string[]> = {
  technology: ['tech', 'software', 'hardware', 'gadget', 'computer', 'phone', 'app'],
  gaming: ['game', 'gaming', 'gamer', 'play', 'stream'],
  education: ['learn', 'study', 'course', 'tutorial', 'education'],
  business: ['business', 'entrepreneur', 'startup', 'money', 'finance', 'invest'],
  lifestyle: ['life', 'lifestyle', 'daily', 'routine', 'habit'],
  health: ['health', 'fitness', 'workout', 'diet', 'nutrition'],
  entertainment: ['fun', 'comedy', 'entertainment', 'funny'],
};

const NICHE_TAGS: Record<string, readonly string[]> = {
  technology: ['tech', 'technology', 'innovation', 'future tech', 'tech news'],
  gaming: ['gaming', 'gameplay', 'walkthrough', 'lets play'],
  education: ['educational', 'learning', 'study tips', 'online learning'],
  business: ['business tips', 'entrepreneurship', 'startup', 'business strategy'],
  lifestyle: ['lifestyle', 'life hacks', 'daily routine', 'productivity'],
  health: ['health tips', 'fitness', 'healthy living', 'wellness'],
  entertainment: ['entertainment', 'fun', 'viral', 'trending'],
  general: ['video', 'youtube', 'content'],
};

const NICHE_HASHTAGS: Record<string, readonly string[]> = {
  technology: ['#tech', '#technology', '#innovation'],
  gaming: ['#gaming', '#gamer', '#games'],
  education: ['#education', '#learning', '#study'],
  business: ['#business', '#entrepreneur', '#success'],
  lifestyle: ['#lifestyle', '#life', '#daily'],
  health: ['#health', '#fitness', '#wellness'],
  entertainment: ['#entertainment', '#fun', '#funny'],
};

const CONTENT_TYPE_TAGS: Record<string, readonly string[]> = {
  Tutorial: ['how to', 'tutorial', 'guide', 'step by step', 'learn'],
  Explainer: ['explained', 'what is', 'understanding'],
  Review: ['review', 'comparison', 'vs', 'best'],
  List: ['top 10', 'best', 'list', 'countdown'],
  Story: ['story', 'journey', 'experience'],
};

/**
 * Optimize a title for YouTube SEO.
 */
export function optimizeTitle(originalTitle: string, keywords: readonly string[]): string {
  let optimized = originalTitle.trim();

  const hasPowerWord = POWER_WORDS.some((w) =>
    optimized.toLowerCase().includes(w.toLowerCase()),
  );
  if (!hasPowerWord && optimized.length < 60) {
    const word = POWER_WORDS[Math.floor(Math.random() * POWER_WORDS.length)];
    optimized = `${word} ${optimized}`;
  }

  const year = new Date().getFullYear().toString();
  if (!optimized.includes(year) && optimized.length < 70) {
    optimized = `${optimized} (${year})`;
  }

  const primary = keywords[0];
  if (primary && !optimized.toLowerCase().includes(primary.toLowerCase())) {
    optimized = `${optimized} - ${primary}`;
  }

  if (optimized.length > 100) {
    optimized = optimized.slice(0, 97) + '...';
  }

  return titleCase(optimized);
}

/**
 * Generate a structured YouTube description.
 */
export function generateDescription(
  script: ScriptForSEO,
  input: SEOOptimizationInput,
): string {
  const lines: string[] = [];
  const hook = `${script.title} - In this video, you'll discover ${input.angle.toLowerCase()}.`;
  lines.push(hook, '');

  if (script.mainContent?.sections?.length) {
    lines.push("WHAT YOU'LL LEARN:");
    for (const section of script.mainContent.sections.slice(0, 5)) {
      lines.push(`- ${section.title}`);
    }
    lines.push('');
  }

  let timestamp = 20;
  lines.push('TIMESTAMPS:');
  lines.push('00:00 Introduction');
  if (script.mainContent?.sections) {
    for (const section of script.mainContent.sections) {
      const m = Math.floor(timestamp / 60);
      const s = timestamp % 60;
      lines.push(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${section.title}`);
      timestamp += section.duration;
    }
  }
  lines.push('');

  const top3 = input.keywords.slice(0, 3).join(', ');
  lines.push('ABOUT THIS VIDEO:');
  lines.push(
    `This comprehensive guide on ${input.topic} covers everything you need to know. ` +
    `Perfect for ${input.targetAudience}. Keywords: ${top3}.`,
  );
  lines.push('');
  lines.push('Subscribe for more content!');
  lines.push('');
  lines.push('DISCLAIMER:');
  lines.push('This video is for educational purposes only.');

  return lines.join('\n');
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

/**
 * Generate chapter timestamps from script sections.
 */
export function generateChapters(script: ScriptForSEO): ChapterEntry[] {
  const chapters: ChapterEntry[] = [];
  chapters.push({ time: '00:00', title: 'Introduction', seconds: 0 });

  let currentTime = 20;
  if (script.mainContent?.sections) {
    for (const section of script.mainContent.sections) {
      const m = Math.floor(currentTime / 60);
      const s = currentTime % 60;
      chapters.push({
        time: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        title: section.title,
        seconds: currentTime,
      });
      currentTime += section.duration;
    }
  }

  const cm = Math.floor(currentTime / 60);
  const cs = currentTime % 60;
  chapters.push({
    time: `${String(cm).padStart(2, '0')}:${String(cs).padStart(2, '0')}`,
    title: 'Conclusion & Next Steps',
    seconds: currentTime,
  });

  return chapters;
}

/**
 * Calculate an SEO score (0-100) for title, description, and tags.
 */
export function calculateSEOScore(
  title: string,
  description: string,
  tags: readonly string[],
): number {
  let score = 0;

  if (title.length >= 60 && title.length <= 70) score += 10;
  else if (title.length >= 50 && title.length <= 100) score += 5;
  if (/\d/.test(title)) score += 5;
  if (/[A-Z]/.test(title)) score += 5;
  if (title.includes(new Date().getFullYear().toString())) score += 5;
  if (['how', 'what', 'why', 'best', 'top'].some((w) => title.toLowerCase().includes(w))) score += 5;

  if (description.length >= 200) score += 10;
  if (description.includes('TIMESTAMPS')) score += 5;
  if (description.includes('http')) score += 5;
  if (description.split('\n').length > 10) score += 5;
  if (tags.length > 0 && description.substring(0, 125).includes(tags[0])) score += 5;

  if (tags.length >= 10) score += 10;
  if (tags.length >= 5) score += 5;
  if (tags.some((t) => t.split(' ').length > 2)) score += 5;
  if (tags.join('').length <= 500) score += 5;
  if (new Set(tags).size === tags.length) score += 5;

  return Math.min(100, score);
}

function identifyNiche(topic: string): string {
  const topicLower = topic.toLowerCase();
  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    if (keywords.some((kw) => topicLower.includes(kw))) return niche;
  }
  return 'general';
}

function generateLongTailKeywords(topic: string): string[] {
  return [
    `how to ${topic}`,
    `${topic} for beginners`,
    `${topic} tutorial`,
    `best ${topic}`,
    `${topic} tips and tricks`,
  ].slice(0, 5);
}

function prioritizeTags(tags: string[], input: SEOOptimizationInput): string[] {
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

function titleCase(str: string): string {
  const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'of', 'on', 'or', 'the', 'to', 'via', 'vs']);
  return str
    .split(' ')
    .map((word, i) => {
      if (i === 0 || !smallWords.has(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(' ');
}
