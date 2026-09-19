/**
 * Tests for Creative Effectiveness Scorer (Phase 5 Milestone 1)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEffectivenessScore,
  computeLogarithmicConfidence,
  determineConfidenceLevel,
  MIN_LEARNING_SAMPLE,
} from '../effectiveness-scorer';

describe('effectiveness-scorer', () => {
  describe('computeLogarithmicConfidence', () => {
    it('returns 0 when sample size is below minimum threshold (N < 5)', () => {
      expect(computeLogarithmicConfidence(0)).toBe(0);
      expect(computeLogarithmicConfidence(1)).toBe(0);
      expect(computeLogarithmicConfidence(3)).toBe(0);
      expect(computeLogarithmicConfidence(4)).toBe(0);
      expect(computeLogarithmicConfidence(MIN_LEARNING_SAMPLE - 1)).toBe(0);
    });

    it('computes positive logarithmic confidence when sample size >= 5', () => {
      const conf5 = computeLogarithmicConfidence(5);
      expect(conf5).toBeGreaterThan(0.4);
      expect(conf5).toBeLessThan(0.7);

      const conf10 = computeLogarithmicConfidence(10);
      expect(conf10).toBeGreaterThan(conf5);

      const conf25 = computeLogarithmicConfidence(25);
      expect(conf25).toBeGreaterThan(conf10);
    });

    it('saturates confidence at N=50 with perfect consistency', () => {
      const conf50 = computeLogarithmicConfidence(50, 1.0);
      expect(conf50).toBe(1.0);

      const conf100 = computeLogarithmicConfidence(100, 1.0);
      expect(conf100).toBe(1.0);
    });

    it('weights consistency factor into confidence calculation', () => {
      const highConsistency = computeLogarithmicConfidence(50, 1.0);
      const lowConsistency = computeLogarithmicConfidence(50, 0.0);

      expect(highConsistency).toBe(1.0);
      expect(lowConsistency).toBe(0.6); // 1.0 * 0.6 + 0.0 * 0.4
    });
  });

  describe('determineConfidenceLevel', () => {
    it('assigns correct tier based on confidence score', () => {
      expect(determineConfidenceLevel(0.95)).toBe('high');
      expect(determineConfidenceLevel(0.70)).toBe('high');
      expect(determineConfidenceLevel(0.69)).toBe('medium');
      expect(determineConfidenceLevel(0.50)).toBe('medium');
      expect(determineConfidenceLevel(0.49)).toBe('low');
      expect(determineConfidenceLevel(0.10)).toBe('low');
      expect(determineConfidenceLevel(0)).toBe('low');
    });
  });

  describe('calculateEffectivenessScore', () => {
    it('returns score 100 for perfect metrics across all dimensions', () => {
      const result = calculateEffectivenessScore({
        ctr: 1.0,
        retentionRate: 1.0,
        conversionRate: 1.0,
        efficiencyScore: 1.0,
        sampleSize: 60,
      });

      expect(result.score).toBe(100);
      expect(result.ctr).toBe(1.0);
      expect(result.retentionRate).toBe(1.0);
      expect(result.conversionRate).toBe(1.0);
      expect(result.efficiencyScore).toBe(1.0);
      expect(result.confidence).toBe(1.0);
      expect(result.confidenceLevel).toBe('high');
      expect(result.sampleSize).toBe(60);
    });

    it('returns score 0 when all inputs are 0', () => {
      const result = calculateEffectivenessScore({
        impressions: 0,
        views: 0,
        clicks: 0,
        conversions: 0,
        sampleSize: 0,
      });

      expect(result.score).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.confidenceLevel).toBe('low');
    });

    it('calculates weighted composite score precisely: (0.35 * ctr) + (0.25 * ret) + (0.30 * conv) + (0.10 * eff)', () => {
      // 0.35 * 0.10 = 0.035
      // 0.25 * 0.50 = 0.125
      // 0.30 * 0.20 = 0.060
      // 0.10 * 0.80 = 0.080
      // Total = 0.300 -> score = 30.00
      const result = calculateEffectivenessScore({
        ctr: 0.10,
        retentionRate: 0.50,
        conversionRate: 0.20,
        efficiencyScore: 0.80,
        sampleSize: 50,
      });

      expect(result.score).toBe(30);
      expect(result.ctr).toBe(0.1);
      expect(result.retentionRate).toBe(0.5);
      expect(result.conversionRate).toBe(0.2);
      expect(result.efficiencyScore).toBe(0.8);
      expect(result.confidenceLevel).toBe('high');
    });

    it('derives CTR, retention, conv, and efficiency from raw event metrics', () => {
      const result = calculateEffectivenessScore({
        impressions: 10000,
        clicks: 500, // CTR = 500 / 10000 = 0.05
        watchTimeSeconds: 24,
        totalDurationSeconds: 60, // Retention = 24 / 60 = 0.40
        conversions: 25, // Conv = 25 / 500 = 0.05
        spendCents: 5000, // $50 spend
        revenueCents: 15000, // $150 revenue -> ROAS = 3.0 -> Efficiency = 1.0 (benchmark)
        sampleSize: 500,
      });

      // 0.35 * 0.05 = 0.0175
      // 0.25 * 0.40 = 0.1000
      // 0.30 * 0.05 = 0.0150
      // 0.10 * 1.00 = 0.1000
      // Total = 0.2325 -> score = 23.25
      expect(result.ctr).toBe(0.05);
      expect(result.retentionRate).toBe(0.40);
      expect(result.conversionRate).toBe(0.05);
      expect(result.efficiencyScore).toBe(1.0);
      expect(result.score).toBe(23.25);
      expect(result.sampleSize).toBe(500);
      expect(result.confidenceLevel).toBe('high');
    });

    it('enforces min sample guard on confidence (< 5 interactions -> confidence 0, low tier)', () => {
      const result = calculateEffectivenessScore({
        impressions: 4,
        clicks: 2,
        conversions: 1,
      });

      expect(result.sampleSize).toBe(4);
      expect(result.confidence).toBe(0);
      expect(result.confidenceLevel).toBe('low');
    });

    it('clamps values greater than 1.0 safely without exceeding bounds', () => {
      const result = calculateEffectivenessScore({
        ctr: 1.5,
        retentionRate: 2.0,
        conversionRate: 1.2,
        efficiencyScore: 5.0,
        sampleSize: 100,
      });

      expect(result.score).toBe(100);
      expect(result.ctr).toBe(1.0);
      expect(result.retentionRate).toBe(1.0);
      expect(result.conversionRate).toBe(1.0);
      expect(result.efficiencyScore).toBe(1.0);
    });
  });
});
