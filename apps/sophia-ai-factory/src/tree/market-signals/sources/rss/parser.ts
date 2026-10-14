import type { MarketSignal } from '@/seed/types/creative-domain';
import { createMarketSignalId } from '@/seed/types/creative-economy/ids';
import type { RssItem, ParsedRssFeed } from './types';

export function parseRssXml(xmlText: string): ParsedRssFeed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

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
    const itemTitle = itemEl.querySelector('title')?.textContent?.trim() ?? '';
    const link = itemEl.querySelector('link')?.textContent?.trim() ?? '';
    const itemDesc = itemEl.querySelector('description')?.textContent?.trim();
    const pubDate = itemEl.querySelector('pubDate')?.textContent?.trim();
    const guid = itemEl.querySelector('guid')?.textContent?.trim();

    const categories: string[] = [];
    const categoryElements = itemEl.querySelectorAll('category');
    for (const catEl of categoryElements) {
      const catText = catEl.textContent?.trim();
      if (catText) categories.push(catText);
    }

    if (itemTitle) {
      items.push({ title: itemTitle, link, description: itemDesc, pubDate, guid, categories });
    }
  }

  return { items, title, description };
}

export function normalizeRssItemToSignal(
  item: RssItem,
  workspaceId: string,
  regionCode: string
): MarketSignal {
  let approxTraffic = 0;
  if (item.description) {
    const trafficMatch = item.description.match(/approx traffic[:\s]*([\d,]+\.?\d*)[KM]?\+?/i);
    if (trafficMatch) {
      const num = parseFloat(trafficMatch[1].replace(/,/g, ''));
      const multiplier = trafficMatch[0].toUpperCase().includes('M') ? 1_000_000 : 1_000;
      approxTraffic = num * multiplier;
    }
  }

  const publishedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
  const confidence =
    approxTraffic > 0 ? Math.min(0.95, 0.5 + Math.log10(approxTraffic) / 10) : 0.5;
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
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    consumed: false,
    createdAt: Date.now(),
  };
}

export function parseRssXmlForTest(xmlText: string): ParsedRssFeed {
  return parseRssXml(xmlText);
}
