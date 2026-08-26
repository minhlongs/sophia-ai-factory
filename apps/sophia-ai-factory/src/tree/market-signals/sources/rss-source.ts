/**
 * Google Trends RSS source adapter — fetches daily trending searches.
 *
 * Public RSS feed — NO API key required.
 * Normalizes to MarketSignal(type='search').
 *
 * Layer: tree (domain reusable)
 */

import { logger } from '@/seed/utils/logger-utility';
import type { MarketSignal } from '@/seed/types/creative-domain';
import { createMarketSignalId } from '@/seed/types/creative-economy/ids';

interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  guid?: string;
  categories?: string[];
}

interface ParsedRssFeed {
  items: RssItem[];
  title: string;
  description: string;
}

// Google Trends RSS URLs by region
const GOOGLE_TRENDS_RSS: Record<string, string> = {
  US: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US',
  VN: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=VN',
  GB: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=GB',
  CA: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=CA',
  AU: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=AU',
  DE: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=DE',
  FR: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=FR',
  JP: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=JP',
  KR: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR',
  BR: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=BR',
  IN: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=IN',
  MX: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=MX',
  // Global (no geo parameter)
  GLOBAL: 'https://trends.google.com/trends/trendingsearches/daily/rss',
};

const REGION_CODES = Object.keys(GOOGLE_TRENDS_RSS);

export interface RssSourceConfig {
  workspaceId: string;
  regionCode?: string;
  maxSignals?: number;
}

export interface SourceResult {
  signals: MarketSignal[];
  blockedReason?: string;
}

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
      // Google Trends RSS doesn't need cache control but let's be respectful
      // cf: { cacheTtl: 3600 }, // Not available in standard fetch
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

    logger.info('[rss-source] Fetched Google Trends signals', { workspaceId, regionCode, count: signals.length });
    return { signals };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[rss-source] Failed to fetch Google Trends RSS', { workspaceId, regionCode, error: error.message });
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
    if (region === 'GLOBAL') continue; // Skip global, handled separately if needed
    const result = await fetchGoogleTrendsSignals({ ...config, regionCode: region, maxSignals: Math.ceil((config.maxSignals ?? 50) / REGION_CODES.length) });
    if (result.blockedReason) {
      blockedReasons.push(`${region}: ${result.blockedReason}`);
    }
    allSignals.push(...result.signals);
  }

  // Dedupe by title (case-insensitive)
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

/**
 * Parse RSS XML to structured feed.
 * Uses DOMParser (available in Cloudflare Workers and Node 18+).
 */
function parseRssXml(xmlText: string): ParsedRssFeed {
  // Cloudflare Workers supports DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML parse error: ${parseError.textContent}`);
  }

  const channel = doc.querySelector('channel');
  if (!channel) {
    throw new Error('Invalid RSS: no channel element');
  }

  const title = channel.querySelector('title')?.textContent?.trim() ?? 'Google Trends';
  const description = channel.querySelector('description')?.textContent?.trim() ?? '';

  const items: RssItem[] = [];
  const itemElements = doc.querySelectorAll('item');

  for (const itemEl of itemElements) {
    const title = itemEl.querySelector('title')?.textContent?.trim() ?? '';
    const link = itemEl.querySelector('link')?.textContent?.trim() ?? '';
    const description = itemEl.querySelector('description')?.textContent?.trim();
    const pubDate = itemEl.querySelector('pubDate')?.textContent?.trim();
    const guid = itemEl.querySelector('guid')?.textContent?.trim();

    // Google Trends RSS has categories in <category> elements
    const categories: string[] = [];
    const categoryElements = itemEl.querySelectorAll('category');
    for (const catEl of categoryElements) {
      const catText = catEl.textContent?.trim();
      if (catText) categories.push(catText);
    }

    if (title) {
      items.push({ title, link, description, pubDate, guid, categories });
    }
  }

  return { items, title, description };
}

/**
 * Normalize RSS item to MarketSignal(type='search').
 * Confidence based on position in feed (earlier = higher).
 * Relevance score based on approx_traffic if available.
 */
function normalizeRssItemToSignal(item: RssItem, workspaceId: string, regionCode: string): MarketSignal {
  // Parse approx traffic from description or dedicated element
  // Google Trends RSS format: "Search term (approx traffic: 100K+)"
  let approxTraffic = 0;
  if (item.description) {
    const trafficMatch = item.description.match(/approx traffic[:\s]*([\d,]+\.?\d*)[KM]?\+?/i);
    if (trafficMatch) {
      const num = parseFloat(trafficMatch[1].replace(/,/g, ''));
      const multiplier = trafficMatch[0].toUpperCase().includes('M') ? 1_000_000 : 1_000;
      approxTraffic = num * multiplier;
    }
  }

  // Parse pubDate if available
  const publishedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

  // Confidence: higher for earlier items in feed (0.9 down to 0.3)
  // We don't have position here, so use traffic as proxy
  const confidence = approxTraffic > 0 ? Math.min(0.95, 0.5 + Math.log10(approxTraffic) / 10) : 0.5;

  // Relevance score: normalized traffic (0-1)
  const relevanceScore = approxTraffic > 0 ? Math.min(1, approxTraffic / 1_000_000) : 0.3;

  return {
    id: createMarketSignalId(),
    workspaceId,
    type: 'search',
    source: 'google-trends-rss',
    title: item.title,
    summary: item.description ?? `Trending search in ${regionCode}`,
    data: {
      searchTerm: item.title,
      regionCode,
      approxTraffic,
      sourceUrl: item.link,
      categories: item.categories,
      publishedAt: new Date(publishedAt).toISOString(),
      guid: item.guid,
    },
    confidence,
    relevanceScore,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours (daily trends)
    consumed: false,
    createdAt: Date.now(),
  };
}

/**
 * Test helper: parse RSS from string (for unit tests with fixtures).
 */
export function parseRssXmlForTest(xmlText: string): ParsedRssFeed {
  return parseRssXml(xmlText);
}