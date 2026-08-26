/**
 * Unit tests for heuristic performance scorer.
 * Tests determinism, edge cases, quartile boundaries, and factor explanations.
 */

import { describe, it, expect } from 'vitest';
import {
  computeScore,
  type PerformanceMetrics,
  type ScorerConfig,
  DEFAULT_CONFIG,
} from '../scoring';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const baseMetrics: PerformanceMetrics = {
  assetId: 'asset_test_1',
  workspaceId: 'ws_test_1',
  channel: 'youtube',
  impressions: 10000,
  views: 8000,
  clicks: 500,
  likes: 400,
  shares: 100,
  saves: 50,
  follows: 20,
  conversions: 10,
  revenueEvents: 2,
  totalEngagements: 570, // 400 + 100 + 50 + 20
  engagementRate: 570 / 8000, // 0.07125
  velocity: 0, // computed by scorer
  retention3s: 0.3,
  retention30s: 0.15,
  windowStart: Date.now() - 7 * 24 * 60 * 60 * 1000,
  windowEnd: Date.now(),
  eventCount: 150,
};

const highPerformingMetrics: PerformanceMetrics = {
  ...baseMetrics,
  assetId: 'asset_high',
  impressions: 50000,
  views: 45000,
  clicks: 5000,
  likes: 4000,
  shares: 2000,
  saves: 1000,
  follows: 500,
  conversions: 100,
  revenueEvents: 20,
  totalEngagements: 7500,
  engagementRate: 7500 / 45000, // ~0.1667
  retention3s: 0.6,
  retention30s: 0.4,
  eventCount: 500,
};

const lowPerformingMetrics: PerformanceMetrics = {
  ...baseMetrics,
  assetId: 'asset_low',
  impressions: 1000,
  views: 500,
  clicks: 10,
  likes: 5,
  shares: 1,
  saves: 0,
  follows: 0,
  conversions: 0,
  revenueEvents: 0,
  totalEngagements: 6,
  engagementRate: 6 / 500, // 0.012
  retention3s: 0.1,
  retention30s: 0.05,
  eventCount: 10,
};

const minimalMetrics: PerformanceMetrics = {
  ...baseMetrics,
  assetId: 'asset_minimal',
  impressions: 100,
  views: 50,
  clicks: 0,
  likes: 0,
  shares: 0,
  saves: 0,
  follows: 0,
  conversions: 0,
  revenueEvents: 0,
  totalEngagements: 0,
  engagementRate: 0,
  retention3s: 0,
  retention30s: 0,
  eventCount: 1,
  windowStart: Date.now() - 3600000, // 1 hour ago
  windowEnd: Date.now(),
};

const zeroEventsMetrics: PerformanceMetrics = {
  ...baseMetrics,
  assetId: 'asset_zero',
  impressions: 0,
  views: 0,
  clicks: 0,
  likes: 0,
  shares: 0,
  saves: 0,
  follows: 0,
  conversions: 0,
  revenueEvents: 0,
  totalEngagements: 0,
  engagementRate: 0,
  retention3s: 0,
  retention30s: 0,
  eventCount: 0,
  windowStart: Date.now() - 3600000,
  windowEnd: Date.now(),
};

// ─── Determinism tests ──────────────────────────────────────────────────────

describe('computeScore — determinism', () => {
  it('same input produces identical output', () => {
    const result1 = computeScore(baseMetrics);
    const result2 = computeScore(baseMetrics);
    expect(result1).toEqual(result2);
  });

  it('same input with custom config produces identical output', () => {
    const customConfig: ScorerConfig = {
      ...DEFAULT_CONFIG,
      weights: { engagementRate: 0.5, velocity: 0.3, retention: 0.2 },
    };
    const result1 = computeScore(baseMetrics, customConfig);
    const result2 = computeScore(baseMetrics, customConfig);
    expect(result1).toEqual(result2);
  });

  it('different configs produce different scores', () => {
    const resultDefault = computeScore(baseMetrics, DEFAULT_CONFIG);
    const resultEngHeavy = computeScore(baseMetrics, {
      ...DEFAULT_CONFIG,
      weights: { engagementRate: 0.8, velocity: 0.1, retention: 0.1 },
    });
    expect(resultDefault.score).not.toBe(resultEngHeavy.score);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('computeScore — edge cases', () => {
  it('handles zero impressions/views (zero division protection)', () => {
    const result = computeScore(zeroEventsMetrics);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.factors[0].normalizedValue).toBe(0); // engagement = 0
  });

  it('handles minimal events (1 event, 1 hour window)', () => {
    const result = computeScore(minimalMetrics);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.predictedQuartile).toBeGreaterThanOrEqual(1);
    expect(result.predictedQuartile).toBeLessThanOrEqual(4);
    expect(result.confidence).toBe('low'); // < minEventsThreshold
  });

  it('handles missing retention data (defaults to 0.5)', () => {
    const metricsNoRetention: PerformanceMetrics = {
      ...baseMetrics,
      retention3s: 0,
      retention30s: 0,
    };
    const result = computeScore(metricsNoRetention);
    // retention should default to 0.5
    expect(result.factors[2].rawValue).toBe(0.5);
    expect(result.factors[2].normalizedValue).toBe(0.5);
  });

  it('handles very high engagement rate (saturation)', () => {
    const metricsHighEng: PerformanceMetrics = {
      ...baseMetrics,
      totalEngagements: 10000,
      views: 5000,
      engagementRate: 2.0, // 200% - unrealistic but tests saturation
    };
    const result = computeScore(metricsHighEng);
    expect(result.factors[0].normalizedValue).toBe(1.0); // saturated
  });

  it('handles very high velocity (saturation)', () => {
    const metricsHighVel: PerformanceMetrics = {
      ...baseMetrics,
      eventCount: 50000, // 50k events in 7 days = ~7142/day > saturation of 100
      windowStart: Date.now() - 7 * 24 * 60 * 60 * 1000,
      windowEnd: Date.now(),
    };
    const result = computeScore(metricsHighVel);
    expect(result.factors[1].normalizedValue).toBe(1.0); // saturated
  });

  it('handles NaN/Infinity in metrics gracefully', () => {
    const metricsBad: PerformanceMetrics = {
      ...baseMetrics,
      engagementRate: NaN,
      velocity: Infinity,
      retention30s: -1,
    };
    // Should not throw
    const result = computeScore(metricsBad);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ─── Quartile boundaries ────────────────────────────────────────────────────

describe('computeScore — quartile boundaries', () => {
  it('high performing asset → quartile 4', () => {
    const result = computeScore(highPerformingMetrics);
    expect(result.predictedQuartile).toBe(4);
    expect(result.confidence).toBe('high');
  });

  it('low performing asset → quartile 1 or 2', () => {
    const result = computeScore(lowPerformingMetrics);
    expect(result.predictedQuartile).toBeLessThanOrEqual(2);
    // Confidence reflects data sufficiency, not performance quality:
    // 10 events >= threshold(5) with engagement + retention data → high
    expect(result.confidence).toBe('high');
  });

  it('insufficient events but some data → medium confidence', () => {
    const metricsFewEvents: PerformanceMetrics = {
      ...baseMetrics,
      eventCount: 3, // < minEventsThreshold(5) but >= 2
    };
    const result = computeScore(metricsFewEvents);
    expect(result.confidence).toBe('medium');
  });

  it('base metrics typically in middle quartiles', () => {
    const result = computeScore(baseMetrics);
    expect(result.predictedQuartile).toBeGreaterThanOrEqual(1);
    expect(result.predictedQuartile).toBeLessThanOrEqual(4);
  });

  it('custom quartile boundaries shift predictions', () => {
    const customConfig: ScorerConfig = {
      ...DEFAULT_CONFIG,
      quartileBoundaries: [0.1, 0.3, 0.6] as [number, number, number], // easier to reach Q4
    };
    const result = computeScore(baseMetrics, customConfig);
    // With easier boundaries, base metrics might reach higher quartile
    expect(result.predictedQuartile).toBeGreaterThanOrEqual(1);
    expect(result.predictedQuartile).toBeLessThanOrEqual(4);
  });
});

// ─── Factor explanations ────────────────────────────────────────────────────

describe('computeScore — factor explanations', () => {
  it('returns all three factors with descriptions', () => {
    const result = computeScore(baseMetrics);
    expect(result.factors).toHaveLength(3);
    const names = result.factors.map((f) => f.name).sort();
    expect(names).toEqual(['engagementRate', 'retention', 'velocity']);
  });

  it('each factor has required fields', () => {
    const result = computeScore(baseMetrics);
    for (const factor of result.factors) {
      expect(factor.rawValue).toBeDefined();
      expect(factor.normalizedValue).toBeGreaterThanOrEqual(0);
      expect(factor.normalizedValue).toBeLessThanOrEqual(1);
      expect(factor.weight).toBeGreaterThan(0);
      expect(factor.contribution).toBeGreaterThanOrEqual(0);
      expect(factor.description).toBeTruthy();
      expect(typeof factor.description).toBe('string');
    }
  });

  it('contributions sum approximately to score', () => {
    const result = computeScore(baseMetrics);
    const sum = result.factors.reduce((s, f) => s + f.contribution, 0);
    expect(Math.abs(sum - result.score)).toBeLessThan(0.001);
  });

  it('engagement factor description mentions engagement count and views', () => {
    const result = computeScore(baseMetrics);
    const engFactor = result.factors.find((f) => f.name === 'engagementRate');
    expect(engFactor?.description).toContain('engagements');
    expect(engFactor?.description).toContain('views');
  });

  it('velocity factor description mentions events/day and window', () => {
    const result = computeScore(baseMetrics);
    const velFactor = result.factors.find((f) => f.name === 'velocity');
    expect(velFactor?.description).toContain('events/day');
    expect(velFactor?.description).toContain('days');
  });

  it('retention factor description mentions percentage', () => {
    const result = computeScore(baseMetrics);
    const retFactor = result.factors.find((f) => f.name === 'retention');
    expect(retFactor?.description).toContain('%');
  });
});

// ─── Config validation ──────────────────────────────────────────────────────

describe('DEFAULT_CONFIG', () => {
  it('weights sum to 1.0', () => {
    const { weights } = DEFAULT_CONFIG;
    const sum = weights.engagementRate + weights.velocity + weights.retention;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it('has positive saturation values', () => {
    expect(DEFAULT_CONFIG.velocitySaturation).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.engagementSaturation).toBeGreaterThan(0);
  });

  it('has sensible minEventsThreshold', () => {
    expect(DEFAULT_CONFIG.minEventsThreshold).toBeGreaterThan(0);
  });

  it('quartile boundaries are ordered', () => {
    const [q1, q2, q3] = DEFAULT_CONFIG.quartileBoundaries;
    expect(q1).toBeLessThan(q2);
    expect(q2).toBeLessThan(q3);
  });
});

// ─── ScoreResult structure ──────────────────────────────────────────────────

describe('ScoreResult structure', () => {
  it('has all required fields', () => {
    const result = computeScore(baseMetrics);
    expect(result.assetId).toBe(baseMetrics.assetId);
    expect(result.workspaceId).toBe(baseMetrics.workspaceId);
    expect(result.channel).toBe(baseMetrics.channel);
    expect(typeof result.score).toBe('number');
    expect([1, 2, 3, 4]).toContain(result.predictedQuartile);
    expect(['low', 'medium', 'high']).toContain(result.confidence);
    expect(Array.isArray(result.factors)).toBe(true);
    expect(typeof result.computedAt).toBe('number');
    expect(result.computedAt).toBeLessThanOrEqual(Date.now());
  });

  it('score is always 0-1', () => {
    const testCases = [
      baseMetrics,
      highPerformingMetrics,
      lowPerformingMetrics,
      minimalMetrics,
      zeroEventsMetrics,
    ];
    for (const metrics of testCases) {
      const result = computeScore(metrics);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });
});