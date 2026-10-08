/**
 * @file virality-arbitrage.ts
 * @description Zero-IO mathematical engine for cross-platform virality scoring,
 * Jensen-Shannon hook divergence, and metadata transformation.
 * @layer tree
 */

export type PlatformType = 'TIKTOK' | 'YOUTUBE_SHORTS' | 'INSTAGRAM_REELS';

export interface ViralityMetrics {
  completionRate?: number;
  rewatchRate?: number;
  shareRate?: number;
  commentRate?: number;
  likeRate?: number;
  viewedVsSwipedRate?: number;
  dmShareRate?: number;
  saveRate?: number;
  averagePercentageViewed?: number;
  [key: string]: number | undefined;
}

export type PlatformWeights = Record<string, number>;

/**
 * Platform-specific default weights modeling native retention algorithms
 */
export const DEFAULT_VIRALITY_WEIGHTS: Record<PlatformType, PlatformWeights> = {
  TIKTOK: {
    completionRate: 0.35,
    rewatchRate: 0.30,
    shareRate: 0.20,
    commentRate: 0.10,
    likeRate: 0.05,
  },
  YOUTUBE_SHORTS: {
    viewedVsSwipedRate: 0.45,
    completionRate: 0.30,
    shareRate: 0.15,
    likeRate: 0.10,
  },
  INSTAGRAM_REELS: {
    dmShareRate: 0.40,
    saveRate: 0.30,
    completionRate: 0.20,
    likeRate: 0.10,
  },
};

export interface HookMutationResult {
  mutatedTitle: string;
  mutatedTags: string[];
  hookStrategy: string;
  targetPlatform: PlatformType;
}

/**
 * Normalizes platform input string into standardized PlatformType
 */
export function normalizePlatform(platform: string): PlatformType {
  const upper = platform.toUpperCase().trim().replace(/[\s-]+/g, '_');
  if (upper.includes('TIKTOK') || upper === 'TT') return 'TIKTOK';
  if (upper.includes('YOUTUBE') || upper.includes('SHORTS') || upper === 'YT') return 'YOUTUBE_SHORTS';
  if (upper.includes('INSTAGRAM') || upper.includes('REELS') || upper === 'IG') return 'INSTAGRAM_REELS';
  return 'TIKTOK';
}

/**
 * Computes platform-weighted virality score [0, 1] with division-by-zero protection.
 */
export function calculatePlatformViralityScore(
  platform: PlatformType | string,
  metrics: ViralityMetrics,
  weights?: PlatformWeights
): number {
  if (!metrics || typeof metrics !== 'object') {
    return 0;
  }

  const normalizedPlatform = normalizePlatform(platform);
  const activeWeights: PlatformWeights =
    weights && Object.keys(weights).length > 0
      ? weights
      : DEFAULT_VIRALITY_WEIGHTS[normalizedPlatform];

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(activeWeights)) {
    if (typeof weight !== 'number' || isNaN(weight) || weight <= 0) {
      continue;
    }
    const rawVal = metrics[key];
    const val = typeof rawVal === 'number' && !isNaN(rawVal) ? Math.max(0, Math.min(1, rawVal)) : 0;
    weightedSum += weight * val;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return 0;
  }

  const score = weightedSum / totalWeight;
  return Number(Math.max(0, Math.min(1, score)).toFixed(4));
}

/**
 * Computes Jensen-Shannon Divergence (JSD) using base-2 logarithm [0, 1].
 * Symmetric divergence measure between source and target token distributions.
 */
export function calculateHookDivergence(sourceTokens: string[], targetTokens: string[]): number {
  const cleanSource = (sourceTokens || [])
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 0);
  const cleanTarget = (targetTokens || [])
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 0);

  if (cleanSource.length === 0 && cleanTarget.length === 0) {
    return 0;
  }
  if (cleanSource.length === 0 || cleanTarget.length === 0) {
    return 1.0;
  }

  // Count frequencies
  const freqP = new Map<string, number>();
  for (const token of cleanSource) {
    freqP.set(token, (freqP.get(token) || 0) + 1);
  }

  const freqQ = new Map<string, number>();
  for (const token of cleanTarget) {
    freqQ.set(token, (freqQ.get(token) || 0) + 1);
  }

  // Build union vocabulary
  const vocab = new Set<string>([...freqP.keys(), ...freqQ.keys()]);
  const lenP = cleanSource.length;
  const lenQ = cleanTarget.length;

  let klPM = 0;
  let klQM = 0;

  for (const word of vocab) {
    const p = (freqP.get(word) || 0) / lenP;
    const q = (freqQ.get(word) || 0) / lenQ;
    const m = 0.5 * (p + q);

    if (p > 0 && m > 0) {
      klPM += p * Math.log2(p / m);
    }
    if (q > 0 && m > 0) {
      klQM += q * Math.log2(q / m);
    }
  }

  const jsd = 0.5 * klPM + 0.5 * klQM;
  return Number(Math.max(0, Math.min(1, jsd)).toFixed(4));
}

/**
 * Mutates video hook and tags to match native platform virality patterns,
 * avoiding generic shadowban watermarks.
 */
export function mutatePlatformHook(
  title: string,
  tags: string[],
  targetPlatform: PlatformType | string
): HookMutationResult {
  const platform = normalizePlatform(targetPlatform);
  const cleanTitle = (title || '').trim() || 'Untitled Viral Short';

  // Sanitize tags: trim, lowercase, strip leading hash
  const initialTags = (tags || [])
    .map((t) => t.trim().toLowerCase().replace(/^#+/, ''))
    .filter((t) => t.length > 0);

  let mutatedTitle = cleanTitle;
  let hookStrategy = '';
  const platformTags: string[] = [];

  switch (platform) {
    case 'TIKTOK': {
      hookStrategy = '3s High-Pacing Cut + Sound Tag';
      platformTags.push('fyp', 'viral', 'trending', 'tiktokmademebuyit');
      if (!/^(pov:|wait for it|secret:|watch till)/i.test(cleanTitle)) {
        mutatedTitle = `POV: ${cleanTitle}`;
      }
      break;
    }
    case 'YOUTUBE_SHORTS': {
      hookStrategy = 'Looping Audio Endcard + Curiosity Title';
      platformTags.push('shorts', 'youtubeshorts', 'viral', 'trendingshorts');
      if (!/\[watch till end\]|\(wait what\?\)|#shorts/i.test(cleanTitle)) {
        mutatedTitle = `${cleanTitle} [Watch Till End]`;
      }
      break;
    }
    case 'INSTAGRAM_REELS': {
      hookStrategy = 'Send to a friend Trigger Text + Aesthetic Tags';
      platformTags.push('reels', 'reelsinstagram', 'explorepage', 'viralreels');
      if (!/^(send this to|share with|tag someone)/i.test(cleanTitle)) {
        mutatedTitle = `Send this to someone: ${cleanTitle}`;
      }
      break;
    }
  }

  const tagSet = new Set<string>([...initialTags, ...platformTags]);
  const mutatedTags = Array.from(tagSet);

  return {
    mutatedTitle,
    mutatedTags,
    hookStrategy,
    targetPlatform: platform,
  };
}
