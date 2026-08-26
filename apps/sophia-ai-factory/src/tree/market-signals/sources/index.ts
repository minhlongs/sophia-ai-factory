/**
 * Market Signals Sources — barrel export.
 * Layer: tree (domain reusable)
 */

export { fetchYouTubeTrendingSignals, fetchMultiRegionTrending, type YouTubeSourceConfig } from './youtube-source';
export { fetchGoogleTrendsSignals, fetchMultiRegionTrends, type RssSourceConfig, type SourceResult, parseRssXmlForTest } from './rss-source';