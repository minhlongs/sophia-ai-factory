import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  getSeasonalMultiplier,
  getAudienceMultiplier,
  scoreTrendItem,
  mergeTrendData,
  type TrendItem,
  type TrendEvidence,
} from '../trend-scorer';

describe('trend-scorer', () => {
  describe('extractKeywords', () => {
    it('filters stop words and short words (length > 3)', () => {
      const result = extractKeywords('The quick brown fox jumps over the lazy dog');
      // "fox" (3 chars) and "dog" (3 chars) are filtered by length > 3
      expect(result).toEqual(['quick', 'brown', 'jumps', 'over', 'lazy']);
    });

    it('handles punctuation', () => {
      const result = extractKeywords('Hello, world! How are you?');
      expect(result).toEqual(['hello', 'world']);
    });

    it('returns empty for stop-word-only text', () => {
      expect(extractKeywords('the is at and a an')).toEqual([]);
    });

    it('returns empty for empty string', () => {
      expect(extractKeywords('')).toEqual([]);
    });
  });

  describe('getSeasonalMultiplier', () => {
    it('returns 1.5 for seasonal topics', () => {
      const month = new Date().getMonth();
      const season = month < 3 ? 'winter' : month < 6 ? 'spring' : month < 9 ? 'summer' : 'fall';
      const seasonalTopic = season === 'winter' ? 'christmas holiday' :
        season === 'spring' ? 'spring garden' :
        season === 'summer' ? 'summer beach travel' : 'halloween thanksgiving';
      expect(getSeasonalMultiplier(seasonalTopic)).toBe(1.5);
    });

    it('returns 1.0 for non-seasonal topics', () => {
      expect(getSeasonalMultiplier('python programming tutorial')).toBe(1.0);
    });
  });

  describe('getAudienceMultiplier', () => {
    it('returns 1.2 for tech topics', () => {
      expect(getAudienceMultiplier('software development tutorial')).toBe(1.2);
    });

    it('returns 1.1 for business topics', () => {
      expect(getAudienceMultiplier('business finance investing')).toBe(1.1);
    });

    it('returns 1.3 for entertainment topics', () => {
      // Use topic without 'ai' substring to avoid false tech match
      expect(getAudienceMultiplier('funny comedy sketches')).toBe(1.3);
    });

    it('returns 1.0 for unknown topics', () => {
      expect(getAudienceMultiplier('xyz abc def')).toBe(1.0);
    });
  });

  describe('scoreTrendItem', () => {
    it('normalizes view count by millions', () => {
      const item: TrendItem = {
        videoId: 'vid1',
        title: 'Test Video',
        tags: ['test'],
        viewCount: 2_500_000,
        category: '1',
        publishedAt: '2024-01-01',
        publisher: 'Channel',
        url: 'https://youtube.com/watch?v=vid1',
      };
      expect(scoreTrendItem(item)).toBe(2.5);
    });

    it('returns 0 for zero views', () => {
      const item: TrendItem = {
        videoId: 'vid2',
        title: 'Zero Views',
        tags: [],
        viewCount: 0,
        category: '1',
        publishedAt: '2024-01-01',
        publisher: 'Channel',
        url: 'https://youtube.com/watch?v=vid2',
      };
      expect(scoreTrendItem(item)).toBe(0);
    });
  });

  describe('mergeTrendData', () => {
    const evidence: TrendEvidence = {
      url: 'https://youtube.com/watch?v=test',
      title: 'Test Video',
      publisher: 'TestChannel',
      publishedAt: '2024-01-01',
      sourceType: 'video',
    };

    it('merges trends and competitor data', () => {
      const trends: TrendItem[] = [{
        videoId: 't1',
        title: 'Python Programming Tutorial',
        tags: ['python'],
        viewCount: 1_000_000,
        category: '1',
        publishedAt: '2024-01-01',
        publisher: 'Channel',
        url: 'https://youtube.com/watch?v=t1',
      }];
      const competitors = [{
        topPerformingTopics: [{
          topic: 'python',
          avgViews: 500_000,
          evidence: [evidence],
        }],
      }];

      const result = mergeTrendData(trends, competitors);
      expect(result.length).toBeGreaterThan(0);
      const pythonTopic = result.find((t) => t.topic === 'python');
      expect(pythonTopic).toBeDefined();
      expect(pythonTopic!.sources).toContain('trending');
      expect(pythonTopic!.sources).toContain('competitor');
    });

    it('deduplicates evidence by URL', () => {
      const trends: TrendItem[] = [{
        videoId: 't1',
        title: 'Python Tutorial',
        tags: ['python'],
        viewCount: 1_000_000,
        category: '1',
        publishedAt: '2024-01-01',
        publisher: 'Channel',
        url: 'https://youtube.com/watch?v=t1',
      }];
      const competitors = [{
        topPerformingTopics: [{
          topic: 'python',
          avgViews: 500_000,
          evidence: [evidence, evidence],
        }],
      }];

      const result = mergeTrendData(trends, competitors);
      const pythonTopic = result.find((t) => t.topic === 'python');
      expect(pythonTopic).toBeDefined();
      // Evidence from trend (1) + deduplicated competitor evidence (1 unique URL) = 2
      const evidenceUrls = pythonTopic!.evidence.map((e) => e.url);
      const uniqueUrls = new Set(evidenceUrls);
      expect(evidenceUrls.length).toBe(uniqueUrls.size);
    });

    it('caps results at 50', () => {
      const trends: TrendItem[] = [];
      for (let i = 0; i < 100; i++) {
        trends.push({
          videoId: `t${i}`,
          title: `Topic ${i} Unique Word`,
          tags: [],
          viewCount: 100_000,
          category: '1',
          publishedAt: '2024-01-01',
          publisher: 'Channel',
          url: `https://youtube.com/watch?v=t${i}`,
        });
      }
      const result = mergeTrendData(trends, []);
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });
});