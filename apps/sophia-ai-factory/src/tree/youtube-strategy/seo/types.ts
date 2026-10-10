/**
 * SEO Optimization Data Types & Constants
 *
 * @module tree/youtube-strategy/seo/types
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

export const POWER_WORDS = [
  'Ultimate',
  'Complete',
  'Essential',
  'Proven',
  'Secret',
  'Amazing',
  'Powerful',
] as const;

export const NICHE_KEYWORDS: Record<string, readonly string[]> = {
  technology: ['tech', 'software', 'hardware', 'gadget', 'computer', 'phone', 'app'],
  gaming: ['game', 'gaming', 'gamer', 'play', 'stream'],
  education: ['learn', 'study', 'course', 'tutorial', 'education'],
  business: ['business', 'entrepreneur', 'startup', 'money', 'finance', 'invest'],
  lifestyle: ['life', 'lifestyle', 'daily', 'routine', 'habit'],
  health: ['health', 'fitness', 'workout', 'diet', 'nutrition'],
  entertainment: ['fun', 'comedy', 'entertainment', 'funny'],
};

export const NICHE_TAGS: Record<string, readonly string[]> = {
  technology: ['tech', 'technology', 'innovation', 'future tech', 'tech news'],
  gaming: ['gaming', 'gameplay', 'walkthrough', 'lets play'],
  education: ['educational', 'learning', 'study tips', 'online learning'],
  business: ['business tips', 'entrepreneurship', 'startup', 'business strategy'],
  lifestyle: ['lifestyle', 'life hacks', 'daily routine', 'productivity'],
  health: ['health tips', 'fitness', 'healthy living', 'wellness'],
  entertainment: ['entertainment', 'fun', 'viral', 'trending'],
  general: ['video', 'youtube', 'content'],
};

export const NICHE_HASHTAGS: Record<string, readonly string[]> = {
  technology: ['#tech', '#technology', '#innovation'],
  gaming: ['#gaming', '#gamer', '#games'],
  education: ['#education', '#learning', '#study'],
  business: ['#business', '#entrepreneur', '#success'],
  lifestyle: ['#lifestyle', '#life', '#daily'],
  health: ['#health', '#fitness', '#wellness'],
  entertainment: ['#entertainment', '#fun', '#funny'],
};

export const CONTENT_TYPE_TAGS: Record<string, readonly string[]> = {
  Tutorial: ['how to', 'tutorial', 'guide', 'step by step', 'learn'],
  Explainer: ['explained', 'what is', 'understanding'],
  Review: ['review', 'comparison', 'vs', 'best'],
  List: ['top 10', 'best', 'list', 'countdown'],
  Story: ['story', 'journey', 'experience'],
};
