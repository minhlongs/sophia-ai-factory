/**
 * Title & Description Optimizer for YouTube SEO
 *
 * @module tree/youtube-strategy/seo/title-optimizer
 */

import { POWER_WORDS } from './types';

export { generateDescription, generateChapters } from './description-generator';

export function titleCase(str: string): string {
  const smallWords = new Set([
    'a',
    'an',
    'and',
    'as',
    'at',
    'but',
    'by',
    'for',
    'if',
    'in',
    'of',
    'on',
    'or',
    'the',
    'to',
    'via',
    'vs',
  ]);
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
