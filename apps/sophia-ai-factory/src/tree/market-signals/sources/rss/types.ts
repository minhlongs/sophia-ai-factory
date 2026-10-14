import type { MarketSignal } from '@/seed/types/creative-domain';

export interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  guid?: string;
  categories?: string[];
}

export interface ParsedRssFeed {
  items: RssItem[];
  title: string;
  description: string;
}

export interface RssSourceConfig {
  workspaceId: string;
  regionCode?: string;
  maxSignals?: number;
}

export interface SourceResult {
  signals: MarketSignal[];
  blockedReason?: string;
}

// Google Trends RSS URLs by region
export const GOOGLE_TRENDS_RSS: Record<string, string> = {
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
  GLOBAL: 'https://trends.google.com/trends/trendingsearches/daily/rss',
};

export const REGION_CODES = Object.keys(GOOGLE_TRENDS_RSS);
