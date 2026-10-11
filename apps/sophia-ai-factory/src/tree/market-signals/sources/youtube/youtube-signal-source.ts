/**
 * YouTube Market Signal Source Ingestion
 * Layer: tree (domain reusable)
 */

import { getDecryptedCredentials } from '@/tree/publishing/credential-manager';
import { logger } from '@/seed/utils/logger-utility';
import type { MarketSignal } from '@/seed/types/creative-domain';
import { YouTubeSourceConfig, SourceResult, REGION_CODES } from './types';
import { fetchTrendingVideos } from './youtube-client';
import { normalizeVideoToSignal } from './signal-parser';

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
 * Helper to fetch trending for multiple regions (for broader coverage).
 */
export async function fetchMultiRegionTrending(config: YouTubeSourceConfig): Promise<SourceResult> {
  const allSignals: MarketSignal[] = [];
  const blockedReasons: string[] = [];

  for (const region of REGION_CODES) {
    const result = await fetchYouTubeTrendingSignals({
      ...config,
      regionCode: region,
      maxSignals: Math.ceil((config.maxSignals ?? 25) / REGION_CODES.length),
    });
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
    const vid = (s.data as { videoId?: string }).videoId;
    if (!vid || seen.has(vid)) return false;
    seen.add(vid);
    return true;
  });

  return {
    signals: uniqueSignals.slice(0, config.maxSignals ?? 25),
    blockedReason: blockedReasons.length > 0 ? blockedReasons.join('; ') : undefined,
  };
}
