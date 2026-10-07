/**
 * Unit Tests for SaaS & Crypto Trend Scrapers
 *
 * @module tree/affiliate/discovery/__tests__/trend-scrapers.test
 */

import { describe, it, expect } from 'vitest';
import { parseAndRankSaaSTrends } from '../saas-trend-scraper';
import { parseAndRankCryptoTrends } from '../crypto-trend-scraper';

describe('Trend Scrapers', () => {
  describe('SaaS Trend Scraper', () => {
    it('filters out low upvote items and assigns categories properly', () => {
      const sample = [
        {
          name: 'Copilot DevKit',
          tagline: 'AI code review and test generation agent',
          url: 'https://copilotdevkit.com',
          votesCount: 150,
        },
        {
          name: 'SEO Rank Boost',
          tagline: 'Automated SEO marketing and keyword tracker',
          url: 'https://seorankboost.io',
          votesCount: 45,
        },
        {
          name: 'Low Quality Tool',
          tagline: 'Random unverified tool',
          url: 'https://random.xyz',
          votesCount: 5, // below threshold
        },
      ];

      const res = parseAndRankSaaSTrends(sample, 20);
      expect(res.niche).toBe('saas_global');
      expect(res.trends).toHaveLength(2);
      expect(res.recommendedCampaignCandidate?.name).toBe('Copilot DevKit');
      expect((res.trends[0] as any).category).toBe('ai_tool');
      expect((res.trends[1] as any).category).toBe('marketing');
    });
  });

  describe('Crypto Trend Scraper', () => {
    it('ranks tokens by 24h price surge momentum and categorizes narratives', () => {
      const sample = [
        {
          id: 'solana-ai-cat',
          name: 'Solana Cat Bot',
          symbol: 'SOLCAT',
          market_cap_rank: 250,
          narrative: 'sol meme',
          data: {
            price_change_percentage_24h: { usd: 45.2 },
            total_volume: '$12,000,000',
          },
        },
        {
          id: 'depin-compute',
          name: 'Render GPU Network',
          symbol: 'RNDR',
          market_cap_rank: 45,
          narrative: 'depin compute',
          data: {
            price_change_percentage_24h: { usd: 12.8 },
            total_volume: '$85,000,000',
          },
        },
      ];

      const res = parseAndRankCryptoTrends(sample);
      expect(res.niche).toBe('crypto_global');
      expect(res.trends).toHaveLength(2);
      expect(res.recommendedCampaignCandidate?.name).toBe('Solana Cat Bot');
      expect((res.trends[0] as any).narrative).toBe('solana_meme');
      expect((res.trends[0] as any).featuredSignal).toBe('BREAKOUT_SURGE');
    });
  });
});
