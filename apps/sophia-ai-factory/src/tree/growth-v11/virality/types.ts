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
