import { logger } from '@/seed/utils/logger-utility';
import type { MarketSignal } from '@/seed/types/creative-domain';
import type { RssSourceConfig, SourceResult } from './types';
import { GOOGLE_TRENDS_RSS, REGION_CODES } from './types';
import { parseRssXml, normalizeRssItemToSignal } from './parser';

/**
 * Fetch Google Trends RSS and normalize to MarketSignal(type='search').
 * No credentials needed — public feed.
 */
export async function fetchGoogleTrendsSignals(config: RssSourceConfig): Promise<SourceResult> {
  const { workspaceId, regionCode = 'US', maxSignals = 50 } = config;

  const rssUrl = GOOGLE_TRENDS_RSS[regionCode.toUpperCase()] ?? GOOGLE_TRENDS_RSS.US;

  try {
    const response = await fetch(rssUrl, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'Sophia-AI-Factory/1.0 (+https://sophia.agencyos.network)',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`RSS fetch ${response.status}: ${text || response.statusText}`);
    }

    const xmlText = await response.text();
    const feed = parseRssXml(xmlText);

    if (feed.items.length === 0) {
      logger.warn('[rss-source] No items in Google Trends RSS', { workspaceId, regionCode });
      return { signals: [] };
    }

    const signals = feed.items
      .slice(0, maxSignals)
      .map(item => normalizeRssItemToSignal(item, workspaceId, regionCode));

    logger.info('[rss-source] Fetched Google Trends signals', {
      workspaceId,
      regionCode,
      count: signals.length,
    });
    return { signals };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[rss-source] Failed to fetch Google Trends RSS', {
      workspaceId,
      regionCode,
      error: error.message,
    });
    return { signals: [], blockedReason: `FETCH_ERROR: ${error.message}` };
  }
}

/**
 * Fetch trends for multiple regions.
 */
export async function fetchMultiRegionTrends(config: RssSourceConfig): Promise<SourceResult> {
  const allSignals: MarketSignal[] = [];
  const blockedReasons: string[] = [];

  for (const region of REGION_CODES) {
    if (region === 'GLOBAL') continue;
    const result = await fetchGoogleTrendsSignals({
      ...config,
      regionCode: region,
      maxSignals: Math.ceil((config.maxSignals ?? 50) / REGION_CODES.length),
    });
    if (result.blockedReason) {
      blockedReasons.push(`${region}: ${result.blockedReason}`);
    }
    allSignals.push(...result.signals);
  }

  const seen = new Set<string>();
  const uniqueSignals = allSignals.filter(s => {
    const key = s.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    signals: uniqueSignals.slice(0, config.maxSignals ?? 50),
    blockedReason: blockedReasons.length > 0 ? blockedReasons.join('; ') : undefined,
  };
}
