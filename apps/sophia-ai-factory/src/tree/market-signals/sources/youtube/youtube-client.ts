/**
 * YouTube API Client Operations
 * Layer: tree (domain reusable)
 */

import {
  YouTubeVideoItem,
  YouTubeSearchResponse,
  YouTubeCategoriesResponse,
  YOUTUBE_API_BASE,
  MAX_RESULTS,
  YOUTUBE_CATEGORY_NAMES,
} from './types';

/**
 * Fetch trending videos from YouTube Data API.
 */
export async function fetchTrendingVideos(
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
