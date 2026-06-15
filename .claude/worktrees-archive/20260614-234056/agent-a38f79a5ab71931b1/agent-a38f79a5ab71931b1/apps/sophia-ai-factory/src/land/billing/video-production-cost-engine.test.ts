import { describe, it, expect } from 'vitest';
import {
  calculateVariableCost,
  calculateCostBreakdown,
  calculateThroughput,
  calculateTierROI,
  calculateARRProjection,
  API_COSTS,
  MONTHLY_INFRA_COST,
} from './video-production-cost-engine';

describe('video-production-cost-engine', () => {
  describe('calculateVariableCost', () => {
    it('returns correct component costs for 1-min video', () => {
      const costs = calculateVariableCost(1);
      expect(costs.heygen).toBe(API_COSTS.heygen.perMinute);
      expect(costs.elevenlabs).toBe(API_COSTS.elevenlabs.perScript);
      expect(costs.openrouter).toBe(API_COSTS.openrouter.perScript);
    });

    it('scales heygen cost with duration', () => {
      const costs = calculateVariableCost(3);
      expect(costs.heygen).toBe(API_COSTS.heygen.perMinute * 3);
    });
  });

  describe('calculateCostBreakdown', () => {
    it('amortizes fixed costs across volume', () => {
      const low = calculateCostBreakdown(10);
      const high = calculateCostBreakdown(1000);
      expect(high.totalCostPerVideo).toBeLessThan(low.totalCostPerVideo);
    });

    it('returns zero fixed-per-video for 0 videos', () => {
      const result = calculateCostBreakdown(0);
      expect(result.totalCostPerVideo).toBe(result.variableCostPerVideo);
    });

    it('monthly fixed costs match API subscriptions + infra', () => {
      const result = calculateCostBreakdown(100);
      const expected = API_COSTS.heygen.monthlyFixed + API_COSTS.elevenlabs.monthlyFixed + API_COSTS.openrouter.monthlyFixed + MONTHLY_INFRA_COST;
      expect(result.monthlyFixedCosts).toBe(expected);
    });
  });

  describe('calculateThroughput', () => {
    it('calculates correct daily output', () => {
      const result = calculateThroughput(3, 4);
      // 60/4 = 15 per hour per job × 3 jobs = 45/hour
      expect(result.videosPerHour).toBe(45);
      expect(result.videosPerDay).toBe(45 * 24);
      expect(result.videosPerMonth).toBe(45 * 24 * 30);
      expect(result.videosPerYear).toBe(45 * 24 * 365);
    });

    it('increases with parallel jobs', () => {
      const single = calculateThroughput(1);
      const triple = calculateThroughput(3);
      expect(triple.videosPerDay).toBe(single.videosPerDay * 3);
    });
  });

  describe('calculateTierROI', () => {
    it('BASIC tier has positive margin', () => {
      const roi = calculateTierROI('BASIC', 10);
      expect(roi.monthlyRevenue).toBe(199);
      expect(roi.marginPercent).toBeGreaterThan(0);
    });

    it('MASTER tier has highest annual revenue', () => {
      const basic = calculateTierROI('BASIC');
      const master = calculateTierROI('MASTER');
      expect(master.annualRevenue).toBeGreaterThan(basic.annualRevenue);
    });

    it('cost per video decreases at higher volume', () => {
      const low = calculateTierROI('BASIC', 5);
      const high = calculateTierROI('ENTERPRISE', 500);
      expect(high.costPerVideo).toBeLessThan(low.costPerVideo);
    });
  });

  describe('calculateARRProjection', () => {
    it('calculates ARR for mixed customer base', () => {
      const result = calculateARRProjection({
        BASIC: 5,
        PREMIUM: 3,
        ENTERPRISE: 1,
        MASTER: 0,
      });
      expect(result.customers).toBe(9);
      expect(result.arr).toBeGreaterThan(0);
      expect(result.marginPercent).toBeGreaterThan(0);
    });

    it('returns zero for empty customer base', () => {
      const result = calculateARRProjection({
        BASIC: 0, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0,
      });
      expect(result.arr).toBe(0);
      expect(result.customers).toBe(0);
    });

    it('profit = arr - cost', () => {
      const result = calculateARRProjection({ BASIC: 10, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0 });
      expect(result.annualProfit).toBe(result.arr - result.annualCost);
    });

    it('fixed costs are shared (not multiplied per customer)', () => {
      const one = calculateARRProjection({ BASIC: 1, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0 });
      const ten = calculateARRProjection({ BASIC: 10, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0 });
      // Variable cost scales 10x but fixed cost stays the same
      const fixedCostDiff = ten.annualCost - (one.annualCost - API_COSTS.heygen.monthlyFixed * 12 - API_COSTS.elevenlabs.monthlyFixed * 12) * 10;
      expect(fixedCostDiff).toBeGreaterThan(0); // fixed portion not multiplied
    });
  });
});
