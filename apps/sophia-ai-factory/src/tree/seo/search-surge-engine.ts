/**
 * @file search-surge-engine.ts
 * @description Zero-IO domain engine for search velocity anomaly detection & SEO metadata generation
 * @layer tree
 */

import type {
  SearchVelocityPoint,
  SurgeDetectionResult,
  SearchIntent,
  SeoMetadataOutput,
} from '@/seed/types/growth-triad-v6-types';

/**
 * Calculates mean, sample standard deviation, and Z-score for search velocity anomaly detection.
 * Z = (V_t - mu) / sigma
 */
export function detectSearchSurge(
  keyword: string,
  history: SearchVelocityPoint[],
  currentVelocity: number,
  surgeThreshold = 2.5
): SurgeDetectionResult {
  if (history.length === 0) {
    return {
      keyword,
      currentVelocity,
      meanVelocity: currentVelocity,
      stdDev: 0,
      zScore: 0,
      isSurging: false,
      intent: classifySearchIntent(keyword),
    };
  }

  const sum = history.reduce((acc, pt) => acc + pt.velocity, 0);
  const mean = sum / history.length;

  const variance =
    history.reduce((acc, pt) => acc + Math.pow(pt.velocity - mean, 2), 0) /
    history.length;
  const stdDev = Math.sqrt(variance);

  const zScore = stdDev === 0 ? 0 : (currentVelocity - mean) / stdDev;
  const isSurging = zScore >= surgeThreshold && currentVelocity > 200;

  return {
    keyword,
    currentVelocity,
    meanVelocity: Number(mean.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    zScore: Number(zScore.toFixed(2)),
    isSurging,
    intent: classifySearchIntent(keyword),
  };
}

/**
 * Classifies search intent from keyword tokens.
 */
export function classifySearchIntent(keyword: string): SearchIntent {
  const lower = keyword.toLowerCase();
  if (
    lower.includes('buy') ||
    lower.includes('price') ||
    lower.includes('discount') ||
    lower.includes('coupon') ||
    lower.includes('order')
  ) {
    return 'TRANSACTIONAL';
  }
  if (
    lower.includes('best') ||
    lower.includes('vs') ||
    lower.includes('review') ||
    lower.includes('top') ||
    lower.includes('compare')
  ) {
    return 'COMMERCIAL';
  }
  return 'INFORMATIONAL';
}

/**
 * Generates SEO metadata optimized for YouTube/TikTok algorithm discovery.
 */
export function generateSeoMetadata(
  keyword: string,
  intent: SearchIntent
): SeoMetadataOutput {
  const currentYear = 2026;
  const titlePrefix =
    intent === 'COMMERCIAL'
      ? `Top 5 Best ${keyword} (${currentYear} Full Review)`
      : intent === 'TRANSACTIONAL'
      ? `${keyword} Best Price & Deals Guide (${currentYear})`
      : `${keyword} Step-by-Step Complete Guide (${currentYear})`;

  const description =
    `Everything you need to know about ${keyword}. ` +
    `Discover key strategies, feature breakdown, and real-world results in ${currentYear}.\n\n` +
    `📌 Timestamps:\n0:00 - Introduction & Overview\n0:45 - Key Features & Analysis\n2:15 - Real Proof & Comparison\n3:45 - Final Verdict & Recommendation`;

  const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const tags = [
    cleanKeyword,
    `${cleanKeyword} ${currentYear}`,
    `${cleanKeyword} tutorial`,
    `${cleanKeyword} guide`,
    'ai tools',
    'sophia ai',
  ];

  return {
    title: titlePrefix,
    description,
    tags,
    chapters: [
      { time: '0:00', title: 'Introduction & Overview' },
      { time: '0:45', title: 'Key Features & Analysis' },
      { time: '2:15', title: 'Real Proof & Comparison' },
      { time: '3:45', title: 'Final Verdict & Recommendation' },
    ],
  };
}
