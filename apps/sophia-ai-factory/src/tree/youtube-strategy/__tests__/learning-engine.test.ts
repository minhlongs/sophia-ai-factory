import { describe, it, expect } from 'vitest';
import {
  normalizeMetrics,
  extractAttributes,
  calculateBaseline,
  calculateDeltas,
  confidenceFor,
  buildRecommendations,
  type PerformanceMetrics,
  type ContentAttributes,
  type PerformanceSnapshot,
} from '../learning-engine';

describe('learning-engine', () => {
  const baseMetrics: PerformanceMetrics = {
    views: 1000,
    impressions: 500,
    ctr: 5,
    retention: 50,
    averageViewDuration: 120,
    watchMinutes: 300,
    engagementRate: 3,
    performanceScore: 60,
  };

  const attributes: ContentAttributes = {
    topic: 'python',
    format: 'tutorial',
    length: 'medium',
    hookLength: 'concise',
    titleLength: 'concise',
    thumbnailStyle: 'default',
    source: 'autonomous_operator',
  };

  describe('normalizeMetrics', () => {
    it('returns values from analytics report', () => {
      const result = normalizeMetrics({
        analytics: { views: { totalViews: 1000 }, watchTime: { averageViewPercentage: 50 } },
      });
      expect(result.views).toBe(1000);
      expect(result.retention).toBe(50);
    });

    it('returns zero for missing analytics', () => {
      const result = normalizeMetrics({});
      expect(result.views).toBe(0);
      expect(result.impressions).toBe(0);
    });
  });

  describe('extractAttributes', () => {
    it('extracts all attribute dimensions', () => {
      const result = extractAttributes(
        { videoDetails: { title: 'Python Tutorial' } },
        { strategy: { topic: 'python', contentType: 'tutorial' } },
      );
      expect(result.topic).toBe('python');
      expect(result.format).toBe('tutorial');
      expect(result.thumbnailStyle).toBeDefined();
      expect(result.source).toBeDefined();
    });
  });

  describe('calculateBaseline', () => {
    it('computes median from snapshots', () => {
      const snapshots: PerformanceSnapshot[] = [
        { videoId: 'v1', productionId: null, measurementWindow: '24h', publishedAt: '2024-01-01', metrics: { ...baseMetrics, views: 100 }, contentAttributes: attributes, baseline: {}, deltas: {}, confidence: 'low', simulated: false },
        { videoId: 'v2', productionId: null, measurementWindow: '24h', publishedAt: '2024-01-02', metrics: { ...baseMetrics, views: 200 }, contentAttributes: attributes, baseline: {}, deltas: {}, confidence: 'low', simulated: false },
        { videoId: 'v3', productionId: null, measurementWindow: '24h', publishedAt: '2024-01-03', metrics: { ...baseMetrics, views: 300 }, contentAttributes: attributes, baseline: {}, deltas: {}, confidence: 'low', simulated: false },
      ];
      const baseline = calculateBaseline(snapshots);
      expect(baseline.views).toBe(200);
    });

    it('returns zeros for empty snapshots', () => {
      const baseline = calculateBaseline([]);
      expect(baseline.views).toBe(0);
    });
  });

  describe('calculateDeltas', () => {
    it('calculates percentage deltas from baseline', () => {
      const baseline = { views: 100, ctr: 5 };
      const deltas = calculateDeltas({ ...baseMetrics, views: 150 }, baseline);
      expect(deltas.views).toBe(50);
    });

    it('handles zero baseline', () => {
      const baseline = { views: 0 };
      const deltas = calculateDeltas({ ...baseMetrics, views: 100 }, baseline);
      expect(deltas.views).toBeNull();
    });
  });

  describe('confidenceFor', () => {
    it('returns low confidence for small samples', () => {
      expect(confidenceFor({ ...baseMetrics, impressions: 10, views: 5 })).toBe('low');
    });

    it('returns medium confidence for moderate samples', () => {
      expect(confidenceFor({ ...baseMetrics, impressions: 100, views: 20 })).toBe('medium');
    });

    it('returns high confidence for large samples', () => {
      expect(confidenceFor({ ...baseMetrics, impressions: 1000, views: 100 })).toBe('high');
    });
  });

  describe('buildRecommendations', () => {
    it('generates recommendations from performance data', () => {
      const snapshots: PerformanceSnapshot[] = [
        { videoId: 'v1', productionId: null, measurementWindow: '7d', publishedAt: '2024-01-01',
          metrics: { ...baseMetrics, views: 5000, ctr: 8, impressions: 1000, retention: 60, performanceScore: 80 },
          contentAttributes: { ...attributes, format: 'tutorial', hookLength: 'concise' },
          baseline: {}, deltas: {}, confidence: 'high', simulated: false },
        { videoId: 'v2', productionId: null, measurementWindow: '7d', publishedAt: '2024-01-02',
          metrics: { ...baseMetrics, views: 100, ctr: 2, impressions: 100, retention: 20, performanceScore: 30 },
          contentAttributes: { ...attributes, format: 'list', hookLength: 'extended' },
          baseline: {}, deltas: {}, confidence: 'medium', simulated: false },
        { videoId: 'v3', productionId: null, measurementWindow: '7d', publishedAt: '2024-01-03',
          metrics: { ...baseMetrics, views: 3000, ctr: 6, impressions: 500, retention: 45, performanceScore: 65 },
          contentAttributes: { ...attributes, format: 'tutorial', hookLength: 'concise' },
          baseline: {}, deltas: {}, confidence: 'high', simulated: false },
        { videoId: 'v4', productionId: null, measurementWindow: '7d', publishedAt: '2024-01-04',
          metrics: { ...baseMetrics, views: 50, ctr: 1, impressions: 80, retention: 15, performanceScore: 20 },
          contentAttributes: { ...attributes, format: 'list', hookLength: 'extended' },
          baseline: {}, deltas: {}, confidence: 'low', simulated: false },
      ];
      const recommendations = buildRecommendations(snapshots);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].category).toBeDefined();
      expect(recommendations[0].title).toBeDefined();
    });

    it('returns empty for no snapshots', () => {
      expect(buildRecommendations([])).toEqual([]);
    });
  });
});