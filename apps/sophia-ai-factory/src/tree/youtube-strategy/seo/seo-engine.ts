/**
 * SEO Scoring and Optimization Engine
 *
 * @module tree/youtube-strategy/seo/seo-engine
 */

import { generateHashtags, generateTags } from './keyword-analyzer';
import { generateChapters, generateDescription, optimizeTitle } from './title-optimizer';
import type {
  SEOOptimizationInput,
  SEOResult,
  ScriptForSEO,
} from './types';

export function scoreTitle(title: string): number {
  let score = 0;
  if (title.length >= 60 && title.length <= 70) score += 10;
  else if (title.length >= 50 && title.length <= 100) score += 5;
  if (/\d/.test(title)) score += 5;
  if (/[A-Z]/.test(title)) score += 5;
  if (title.includes(new Date().getFullYear().toString())) score += 5;
  if (['how', 'what', 'why', 'best', 'top'].some((w) => title.toLowerCase().includes(w))) score += 5;
  return score;
}

export function scoreDescription(description: string, primaryTag?: string): number {
  let score = 0;
  if (description.length >= 200) score += 10;
  if (description.includes('TIMESTAMPS')) score += 5;
  if (description.includes('http')) score += 5;
  if (description.split('\n').length > 10) score += 5;
  if (primaryTag && description.substring(0, 125).includes(primaryTag)) score += 5;
  return score;
}

export function scoreTags(tags: readonly string[]): number {
  let score = 0;
  if (tags.length >= 10) score += 10;
  if (tags.length >= 5) score += 5;
  if (tags.some((t) => t.split(' ').length > 2)) score += 5;
  if (tags.join('').length <= 500) score += 5;
  if (new Set(tags).size === tags.length) score += 5;
  return score;
}

/**
 * Calculate an SEO score (0-100) for title, description, and tags.
 */
export function calculateSEOScore(
  title: string,
  description: string,
  tags: readonly string[],
): number {
  const score = scoreTitle(title) + scoreDescription(description, tags[0]) + scoreTags(tags);
  return Math.min(100, score);
}

/**
 * Orchestrate full SEO optimization for a YouTube video.
 */
export function optimizeVideoSEO(
  script: ScriptForSEO,
  input: SEOOptimizationInput,
): SEOResult {
  const title = optimizeTitle(script.title, input.keywords);
  const description = generateDescription(script, input);
  const tags = generateTags(input);
  const hashtags = generateHashtags(input);
  const chapters = generateChapters(script);
  const seoScore = calculateSEOScore(title, description, tags);

  return {
    title,
    description,
    tags,
    hashtags,
    chapters,
    seoScore,
  };
}
