/**
 * MCU Pricing Tests
 *
 * Tests the MCU pricing calculator:
 * - Feature cost calculations
 * - Tier discounts
 * - Overage pricing
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMcuCost,
  calculateOverageCost,
  getTierByPrice,
  MCU_COSTS,
} from '@/lib/billing/mcu-pricing';
import { POLAR_TIERS } from '@/lib/billing/polar-client';

describe('MCU Pricing Calculator', () => {
  describe('Base Feature Costs', () => {
    it('should have proposal generation costs defined', () => {
      expect(MCU_COSTS['proposal:text:basic']).toBe(10);
      expect(MCU_COSTS['proposal:text:advanced']).toBe(25);
      expect(MCU_COSTS['proposal:text:enterprise']).toBe(50);
    });

    it('should have video generation costs defined', () => {
      expect(MCU_COSTS['video:intro']).toBe(100);
      expect(MCU_COSTS['video:section']).toBe(250);
      expect(MCU_COSTS['video:full_proposal']).toBe(500);
      expect(MCU_COSTS['video:custom']).toBe(100);
    });

    it('should have export costs defined', () => {
      expect(MCU_COSTS['export:pdf']).toBe(5);
      expect(MCU_COSTS['export:html']).toBe(2);
    });

    it('should return 0 for unknown features', () => {
      const cost = calculateMcuCost('unknown_feature');
      expect(cost).toBe(0);
    });
  });

  describe('Tier Discounts', () => {
    const testFeature = 'proposal:text:basic';
    const baseCost = 10;

    it('should apply no discount for Starter tier', () => {
      const cost = calculateMcuCost(testFeature, 'starter');
      expect(cost).toBe(baseCost); // 100% = 10
    });

    it('should apply 10% discount for Growth tier', () => {
      const cost = calculateMcuCost(testFeature, 'growth');
      expect(cost).toBe(9); // 90% of 10 = 9
    });

    it('should apply 20% discount for Premium tier', () => {
      const cost = calculateMcuCost(testFeature, 'premium');
      expect(cost).toBe(8); // 80% of 10 = 8
    });

    it('should apply 30% discount for Master tier', () => {
      const cost = calculateMcuCost(testFeature, 'master');
      expect(cost).toBe(7); // 70% of 10 = 7
    });

    it('should apply tier discount to enterprise proposals', () => {
      const baseEnterpriseCost = MCU_COSTS['proposal:text:enterprise']; // 50

      const starterCost = calculateMcuCost('proposal:text:enterprise', 'starter');
      const growthCost = calculateMcuCost('proposal:text:enterprise', 'growth');
      const premiumCost = calculateMcuCost('proposal:text:enterprise', 'premium');
      const masterCost = calculateMcuCost('proposal:text:enterprise', 'master');

      expect(starterCost).toBe(50); // 100% of 50
      expect(growthCost).toBe(45); // 90% of 50
      expect(premiumCost).toBe(40); // 80% of 50
      expect(masterCost).toBe(35); // 70% of 50
    });
  });

  describe('Overage Pricing', () => {
    it('should calculate overage for Starter tier', () => {
      const tier = POLAR_TIERS.starter;
      const mcuUsed = 600; // 100 over the 500 limit

      const overageCost = calculateOverageCost(mcuUsed, 'starter');
      expect(overageCost).toBe(10); // 100 MCU * $0.10
    });

    it('should calculate overage for Growth tier', () => {
      const mcuUsed = 2500; // 500 over the 2000 limit

      const overageCost = calculateOverageCost(mcuUsed, 'growth');
      expect(overageCost).toBe(40); // 500 MCU * $0.08
    });

    it('should calculate overage for Premium tier (pilot tier)', () => {
      const mcuUsed = 11000; // 1000 over the 10000 limit

      const overageCost = calculateOverageCost(mcuUsed, 'premium');
      expect(overageCost).toBe(60); // 1000 MCU * $0.06
    });

    it('should calculate overage for Master tier', () => {
      const mcuUsed = 26000; // 1000 over the 25000 limit

      const overageCost = calculateOverageCost(mcuUsed, 'master');
      expect(overageCost).toBe(50); // 1000 MCU * $0.05
    });

    it('should return 0 when under limit', () => {
      const overageCost = calculateOverageCost(500, 'starter');
      expect(overageCost).toBe(0);
    });

    it('should return 0 when exactly at limit', () => {
      const overageCost = calculateOverageCost(10000, 'premium');
      expect(overageCost).toBe(0);
    });
  });

  describe('Tier Lookup Functions', () => {
    it('should get tier by price', () => {
      expect(getTierByPrice(4900)).toBe('starter');
      expect(getTierByPrice(14900)).toBe('growth');
      expect(getTierByPrice(49900)).toBe('premium');
      expect(getTierByPrice(99900)).toBe('master');
    });

    it('should return null for unknown price', () => {
      expect(getTierByPrice(999999)).toBeNull();
    });

    it('should have consistent pricing across tiers', () => {
      const tiers = Object.values(POLAR_TIERS);
      const prices = tiers.map(t => t.price);

      // Prices should be ascending
      expect(prices[0]).toBeLessThan(prices[1]);
      expect(prices[1]).toBeLessThan(prices[2]);
      expect(prices[2]).toBeLessThan(prices[3]);
    });

    it('should have consistent MCU credits across tiers', () => {
      const tiers = Object.values(POLAR_TIERS);
      const mcuCredits = tiers.map(t => t.mcuMonthly);

      // MCU credits should be ascending
      expect(mcuCredits[0]).toBeLessThan(mcuCredits[1]);
      expect(mcuCredits[1]).toBeLessThan(mcuCredits[2]);
      expect(mcuCredits[2]).toBeLessThan(mcuCredits[3]);
    });
  });

  describe('Pilot Program Pricing (Premium Tier)', () => {
    it('should have Premium tier at $499/month', () => {
      const premium = POLAR_TIERS.premium;
      expect(premium.price).toBe(49900); // $499 in cents
      expect(premium.price / 100).toBe(499);
    });

    it('should include 10,000 MCU/month for Premium', () => {
      const premium = POLAR_TIERS.premium;
      expect(premium.mcuMonthly).toBe(10000);
    });

    it('should calculate cost per MCU for Premium tier', () => {
      const premium = POLAR_TIERS.premium;
      const costPerMcu = premium.price / premium.mcuMonthly;
      expect(costPerMcu).toBe(4.99); // ~5 cents per MCU
    });

    it('should have best overage rate for Premium tier', () => {
      expect(POLAR_TIERS.premium.mcuOverageRate).toBe(0.06);
      expect(POLAR_TIERS.premium.mcuOverageRate).toBeLessThan(POLAR_TIERS.starter.mcuOverageRate);
      expect(POLAR_TIERS.premium.mcuOverageRate).toBeLessThan(POLAR_TIERS.growth.mcuOverageRate);
    });
  });

  describe('Complex Calculations', () => {
    it('should calculate total cost for multiple features with tier discount', () => {
      const tier = 'premium';

      const proposalCost = calculateMcuCost('proposal:text:advanced', tier);
      const exportCost = calculateMcuCost('export:pdf', tier);
      const apiCallCost = calculateMcuCost('api:call', tier) * 10; // 10 API calls

      const totalCost = proposalCost + exportCost + apiCallCost;

      // proposal:text:advanced = 25 * 0.8 = 20
      // export:pdf = 5 * 0.8 = 4
      // api:call = 1 * 0.8 = 0.8, rounded = 0 (Math.floor)
      expect(proposalCost).toBe(20);
      expect(exportCost).toBe(4);
      expect(totalCost).toBeGreaterThanOrEqual(24);
    });
  });
});
