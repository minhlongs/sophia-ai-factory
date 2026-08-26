/**
 * YouTube Data API source adapter — fetches trending videos and normalizes to MarketSignal.
 *
 * BYOK Doctrine: Uses customer's platform_credentials (OAuth) — NO operator credentials.
 * If credentials unavailable or invalid, returns empty array with BLOCKED reason logged.
 *
 * Layer: tree (domain reusable)
 */

import { getDecryptedCredentials } from '@/tree/publishing/credential-manager';
import { logger } from '@/seed/utils/logger-utility';
import type { MarketSignal } from '@/seed/types/creative-domain';
import { createMarketSignalId } from '@/seed/types/creative-economy/ids';

interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    categoryId: string;
    tags?: string[];
  };
  statistics: {
    viewCount: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeVideoItem[];
  nextPageToken?: string;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
}

interface YouTubeCategoriesResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
    };
  }>;
}

// Category mapping (YouTube video category IDs)
const YOUTUBE_CATEGORY_NAMES: Record<string, string> = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '18': 'Short Movies',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '21': 'Videoblogging',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
  '30': 'Movies',
  '31': 'Anime/Animation',
  '32': 'Action/Adventure',
  '33': 'Classics',
  '34': 'Comedy',
  '35': 'Documentary',
  '36': 'Drama',
  '37': 'Family',
  '38': 'Foreign',
  '39': 'Horror',
  '40': 'Sci-Fi/Fantasy',
  '41': 'Thriller',
  '42': 'Shorts',
  '43': 'Shows',
  '44': 'Trailers',
};

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_RESULTS = 25;
const REGION_CODES = ['US', 'VN', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'KR', 'BR', 'IN', 'MX'];

export interface YouTubeSourceConfig {
  workspaceId: string;
  userId: string;
  regionCode?: string;
  categoryId?: string;
  maxSignals?: number;
}

export interface SourceResult {
  signals: MarketSignal[];
  blockedReason?: string;
}

/**
 * Fetch trending YouTube videos and normalize to MarketSignal(type='trend').
 * Returns empty array if credentials not available or invalid (BYOK doctrine).
 */
export async function fetchYouTubeTrendingSignals(config: YouTubeSourceConfig): Promise<SourceResult> {
  const { workspaceId, userId, regionCode = 'US', categoryId, maxSignals = 25 } = config;

  // Get customer's YouTube credentials (BYOK)
  const credentials = await getDecryptedCredentials(userId, 'youtube');
  if (!credentials || !credentials.accessToken) {
    logger.warn('[youtube-source] No YouTube credentials for user — BYOK required', { userId, workspaceId });
    return { signals: [], blockedReason: 'BYOK_REQUIRED: Customer must connect YouTube account in Setup Wizard' };
  }

  if (credentials.isExpired && !credentials.refreshToken) {
    logger.warn('[youtube-source] YouTube token expired and no refresh token', { userId, workspaceId });
    return { signals: [], blockedReason: 'TOKEN_EXPIRED: YouTube access token expired, re-authentication required' };
  }

  try {
    const videos = await fetchTrendingVideos(credentials.accessToken, regionCode, categoryId, maxSignals);
    if (videos.length === 0) {
      logger.info('[youtube-source] No trending videos returned', { userId, workspaceId, regionCode });
      return { signals: [] };
    }

    const signals = videos.map(video => normalizeVideoToSignal(video, workspaceId, regionCode));
    logger.info('[youtube-source] Fetched trending signals', { userId, workspaceId, count: signals.length });
    return { signals };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[youtube-source] Failed to fetch trending videos', { userId, workspaceId, error: error.message });

    // Check if it's an auth error (401/403)
    if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Unauthorized')) {
      return { signals: [], blockedReason: 'AUTH_FAILED: YouTube credentials invalid or revoked' };
    }
    return { signals: [], blockedReason: `FETCH_ERROR: ${error.message}` };
  }
}

/**
 * Fetch trending videos from YouTube Data API.
 */
async function fetchTrendingVideos(
  accessToken: string,
  regionCode: string,
  categoryId: string | undefined,
  maxResults: number
): Promise<YouTubeVideoItem[]> {
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    chart: 'mostPopular',
    regionCode,
    maxResults: String(Math.min(maxResults, MAX_RESULTS)),
    key: '', // Using OAuth, not API key
  });

  if (categoryId) {
    params.set('videoCategoryId', categoryId);
  }

  const url = `${YOUTUBE_API_BASE}/videos?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`YouTube API ${response.status}: ${text || response.statusText}`);
  }

  const data = await response.json() as YouTubeSearchResponse;
  return data.items ?? [];
}

/**
 * Fetch video categories for region (cached in production).
 */
export async function fetchYouTubeCategories(accessToken: string, regionCode = 'US'): Promise<Record<string, string>> {
  const url = `${YOUTUBE_API_BASE}/videoCategories?part=snippet&regionCode=${regionCode}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return YOUTUBE_CATEGORY_NAMES; // Fallback to static map
  }

  const data = await response.json() as YouTubeCategoriesResponse;
  const categories: Record<string, string> = {};
  for (const item of data.items ?? []) {
    categories[item.id] = item.snippet.title;
  }
  return Object.keys(categories).length > 0 ? categories : YOUTUBE_CATEGORY_NAMES;
}

/**
 * Normalize YouTube video to MarketSignal(type='trend').
 * Confidence derived from view velocity (views per hour since publish).
 */
function normalizeVideoToSignal(video: YouTubeVideoItem, workspaceId: string, regionCode: string): MarketSignal {
  const viewCount = parseInt(video.statistics.viewCount, 10) || 0;
  const likeCount = parseInt(video.statistics.likeCount ?? '0', 10) || 0;
  const commentCount = parseInt(video.statistics.commentCount ?? '0', 10) || 0;

  // Calculate view velocity (views per hour)
  const publishedAt = new Date(video.snippet.publishedAt).getTime();
  const hoursSincePublish = Math.max(1, (Date.now() - publishedAt) / (1000 * 60 * 60));
  const viewVelocity = viewCount / hoursSincePublish;

  // Confidence: 0-1 based on view velocity (capped at 1M views/hour = 1.0)
  const confidence = Math.min(1, viewVelocity / 1_000_000);

  // Relevance: engagement rate (likes + comments) / views
  const engagementRate = viewCount > 0 ? (likeCount + commentCount) / viewCount : 0;
  const relevanceScore = Math.min(1, engagementRate * 100); // Scale for readability

  const categoryName = YOUTUBE_CATEGORY_NAMES[video.snippet.categoryId] ?? 'Unknown';

  return {
    id: createMarketSignalId(),
    workspaceId,
    type: 'trend',
    source: 'youtube',
    title: video.snippet.title,
    summary: truncate(video.snippet.description, 500),
    data: {
      videoId: video.id,
      channelTitle: video.snippet.channelTitle,
      categoryId: video.snippet.categoryId,
      categoryName,
      regionCode,
      viewCount,
      likeCount,
      commentCount,
      viewVelocity,
      publishedAt: video.snippet.publishedAt,
      videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
      tags: video.snippet.tags ?? [],
    },
    confidence,
    relevanceScore,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    consumed: false,
    createdAt: Date.now(),
  };
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Helper to fetch trending for multiple regions (for broader coverage).
 */
export async function fetchMultiRegionTrending(config: YouTubeSourceConfig): Promise<SourceResult> {
  const allSignals: MarketSignal[] = [];
  const blockedReasons: string[] = [];

  for (const region of REGION_CODES) {
    const result = await fetchYouTubeTrendingSignals({ ...config, regionCode: region, maxSignals: Math.ceil((config.maxSignals ?? 25) / REGION_CODES.length) });
    if (result.blockedReason) {
      blockedReasons.push(`${region}: ${result.blockedReason}`);
      // If blocked for one region, likely blocked for all — break early
      if (result.blockedReason.startsWith('BYOK_REQUIRED') || result.blockedReason.startsWith('TOKEN_EXPIRED')) {
        break;
      }
    }
    allSignals.push(...result.signals);
  }

  // Dedupe by videoId in data
  const seen = new Set<string>();
  const uniqueSignals = allSignals.filter(s => {
    const vid = s.data.videoId as string | undefined;
    if (!vid || seen.has(vid)) return false;
    seen.add(vid);
    return true;
  });

  return {
    signals: uniqueSignals.slice(0, config.maxSignals ?? 25),
    blockedReason: blockedReasons.length > 0 ? blockedReasons.join('; ') : undefined,
  };
}