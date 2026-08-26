/**
 * Market Signals Sources — Fixture-driven unit tests.
 * Covers youtube-source and rss-source normalizers.
 *
 * Uses shared real-SQLite D1 shim for credential-manager mocks.
 *
 * @module tree/market-signals/__tests__/sources
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

// Mock logger
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock credential-manager (tree layer)
const mockGetDecryptedCredentials = vi.fn();
vi.mock('@/tree/publishing/credential-manager', () => ({
  getDecryptedCredentials: mockGetDecryptedCredentials,
}));

// Mock fetch globally
const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// Import test helper
const { parseRssXmlForTest } = await import('@/tree/market-signals/sources/rss-source');
const { fetchYouTubeTrendingSignals, fetchMultiRegionTrending: fetchYtMultiRegion } = await import('@/tree/market-signals/sources/youtube-source');
const { fetchGoogleTrendsSignals, fetchMultiRegionTrends: fetchRssMultiRegion } = await import('@/tree/market-signals/sources/rss-source');

describe('youtube-source', () => {
  const baseConfig = {
    workspaceId: 'ws-test',
    userId: 'user-123',
    regionCode: 'US',
    maxSignals: 25,
  };

  const mockVideo = {
    id: 'vid_abc123',
    snippet: {
      title: 'Test Trending Video',
      description: 'This is a test video description',
      channelTitle: 'Test Channel',
      publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      categoryId: '20', // Gaming
      tags: ['gaming', 'funny'],
    },
    statistics: {
      viewCount: '100000',
      likeCount: '5000',
      commentCount: '500',
    },
  };

  beforeEach(() => {
    mockGetDecryptedCredentials.mockResolvedValue({
      accessToken: 'ya29.test-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      isExpired: false,
    });
  });

  it('returns BYOK_REQUIRED when no credentials', async () => {
    mockGetDecryptedCredentials.mockResolvedValueOnce(null);

    const result = await fetchYouTubeTrendingSignals(baseConfig);

    expect(result.signals).toEqual([]);
    expect(result.blockedReason).toContain('BYOK_REQUIRED');
  });

  it('returns TOKEN_EXPIRED when token expired and no refresh token', async () => {
    mockGetDecryptedCredentials.mockResolvedValueOnce({
      accessToken: 'expired-token',
      refreshToken: null,
      expiresAt: new Date(Date.now() - 1000),
      isExpired: true,
    });

    const result = await fetchYouTubeTrendingSignals(baseConfig);

    expect(result.signals).toEqual([]);
    expect(result.blockedReason).toContain('TOKEN_EXPIRED');
  });

  it('returns AUTH_FAILED on 401/403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    const result = await fetchYouTubeTrendingSignals(baseConfig);

    expect(result.signals).toEqual([]);
    expect(result.blockedReason).toContain('AUTH_FAILED');
  });

  it('normalizes video to MarketSignal(type=trend) with confidence from view velocity', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: [mockVideo] }),
    });

    const result = await fetchYouTubeTrendingSignals(baseConfig);

    expect(result.signals).toHaveLength(1);
    const signal = result.signals[0];
    expect(signal.type).toBe('trend');
    expect(signal.source).toBe('youtube');
    expect(signal.title).toBe('Test Trending Video');
    expect(signal.confidence).toBeGreaterThan(0);
    expect(signal.confidence).toBeLessThanOrEqual(1);
    expect(signal.relevanceScore).toBeGreaterThanOrEqual(0);
    expect(signal.data.videoId).toBe('vid_abc123');
    expect(signal.data.channelTitle).toBe('Test Channel');
    expect(signal.data.viewVelocity).toBeCloseTo(100000, -2); // ~100k views/hour
    expect(signal.expiresAt).toBeDefined();
  });

  it('handles empty response gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    });

    const result = await fetchYouTubeTrendingSignals(baseConfig);

    expect(result.signals).toEqual([]);
    expect(result.blockedReason).toBeUndefined();
  });

  it('fetchMultiRegionTrending aggregates and dedupes by videoId', async () => {
    const video1 = { ...mockVideo, id: 'vid_1' };
    const video2 = { ...mockVideo, id: 'vid_2' };

    // First region returns video1 and video2
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [video1, video2] }) })
      // Second region returns video2 again (duplicate) and video3
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [video2, { ...mockVideo, id: 'vid_3' }] }) });

    const result = await fetchYtMultiRegion({ ...baseConfig, maxSignals: 10 });

    // Should dedupe video2
    expect(result.signals.length).toBeLessThanOrEqual(3);
    const ids = new Set(result.signals.map(s => s.data.videoId));
    expect(ids.size).toBe(result.signals.length);
  });

  it('stops early on BYOK_REQUIRED in multi-region', async () => {
    mockGetDecryptedCredentials.mockResolvedValueOnce(null);

    const result = await fetchYtMultiRegion({ ...baseConfig, maxSignals: 10 });

    expect(result.blockedReason).toContain('BYOK_REQUIRED');
  });
});

describe('rss-source', () => {
  const baseConfig = {
    workspaceId: 'ws-test',
    regionCode: 'US',
    maxSignals: 50,
  };

  // Sample Google Trends RSS XML fixture
  const sampleRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:ht="http://trends.google.com/trends/rss">
  <channel>
    <title>Google Trends - Daily Search Trends</title>
    <link>https://trends.google.com/trends/trendingsearches/daily</link>
    <description>Daily Search Trends</description>
    <item>
      <title>AI Video Generation</title>
      <link>https://trends.google.com/trends/explore?q=AI+Video+Generation</link>
      <description>Search term (approx traffic: 100K+)</description>
      <pubDate>Mon, 26 Aug 2026 10:00:00 GMT</pubDate>
      <guid>trend_1</guid>
      <category>Technology</category>
    </item>
    <item>
      <title>Faceless YouTube Channels</title>
      <link>https://trends.google.com/trends/explore?q=Faceless+YouTube+Channels</link>
      <description>Search term (approx traffic: 50K+)</description>
      <pubDate>Mon, 26 Aug 2026 09:00:00 GMT</pubDate>
      <guid>trend_2</guid>
      <category>Entertainment</category>
    </item>
    <item>
      <title>Viral TikTok Trends</title>
      <link>https://trends.google.com/trends/explore?q=Viral+TikTok+Trends</link>
      <description>Search term (approx traffic: 1M+)</description>
      <pubDate>Mon, 26 Aug 2026 08:00:00 GMT</pubDate>
      <guid>trend_3</guid>
      <category>Social Media</category>
    </item>
  </channel>
</rss>`;

  const rssNoTrafficXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Google Trends</title>
    <item>
      <title>Trend Without Traffic</title>
      <link>https://example.com/trend</link>
      <description>Just a description</description>
      <pubDate>Mon, 26 Aug 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

  describe('parseRssXmlForTest', () => {
    it('parses Google Trends RSS with approx_traffic', () => {
      const feed = parseRssXmlForTest(sampleRssXml);

      expect(feed.items).toHaveLength(3);
      expect(feed.items[0].title).toBe('AI Video Generation');
      expect(feed.items[0].categories).toContain('Technology');
    });

    it('handles items without approx_traffic', () => {
      const feed = parseRssXmlForTest(rssNoTrafficXml);

      expect(feed.items).toHaveLength(1);
      expect(feed.items[0].title).toBe('Trend Without Traffic');
    });
  });

  describe('fetchGoogleTrendsSignals', () => {
    it('fetches and normalizes to MarketSignal(type=search)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(sampleRssXml),
      });

      const result = await fetchGoogleTrendsSignals(baseConfig);

      expect(result.signals.length).toBe(3);
      const signal = result.signals[0];
      expect(signal.type).toBe('search');
      expect(signal.source).toBe('google-trends-rss');
      expect(signal.title).toBe('AI Video Generation');
      expect(signal.confidence).toBeGreaterThan(0);
      expect(signal.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(signal.data.searchTerm).toBe('AI Video Generation');
      expect(signal.data.regionCode).toBe('US');
      expect(signal.data.approxTraffic).toBe(100000);
      expect(signal.expiresAt).toBeDefined();
    });

    it('handles fetch error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await fetchGoogleTrendsSignals(baseConfig);

      expect(result.signals).toEqual([]);
      expect(result.blockedReason).toContain('FETCH_ERROR');
    });

    it('handles empty feed gracefully', async () => {
      const emptyRss = `<?xml version="1.0"?><rss><channel><title>Empty</title></channel></rss>`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(emptyRss),
      });

      const result = await fetchGoogleTrendsSignals(baseConfig);

      expect(result.signals).toEqual([]);
      expect(result.blockedReason).toBeUndefined();
    });

    it('handles XML parse error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('not valid xml'),
      });

      const result = await fetchGoogleTrendsSignals(baseConfig);

      expect(result.signals).toEqual([]);
      expect(result.blockedReason).toContain('FETCH_ERROR');
    });
  });

  describe('fetchMultiRegionTrends', () => {
    it('aggregates multiple regions and dedupes by title', async () => {
      const rssUs = sampleRssXml;
      const rssVn = rssUs.replace('AI Video Generation', 'AI Video Generation') // Same title
        .replace('Faceless YouTube Channels', 'TikTok Viral'); // Different title

      mockFetch
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(rssUs) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(rssVn) });

      const result = await fetchRssMultiRegion({ ...baseConfig, maxSignals: 10 });

      // Should dedupe 'AI Video Generation'
      const titles = result.signals.map(s => s.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(titles.length);
    });

    it('continues on partial region failures', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(sampleRssXml) })
        .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Error') });

      const result = await fetchRssMultiRegion({ ...baseConfig, maxSignals: 10 });

      // Should still have signals from first region
      expect(result.signals.length).toBeGreaterThan(0);
      // Should have blockedReason for failed region
      expect(result.blockedReason).toContain('VN:');
    });
  });
});