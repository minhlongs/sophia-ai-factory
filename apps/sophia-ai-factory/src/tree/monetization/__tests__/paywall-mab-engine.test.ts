/**
 * @file paywall-mab-engine.test.ts
 * @description Zero-mock unit tests for Paywall MAB & Price Elasticity Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import {
  calculateElasticityEpsilon,
  calculateOptimalPriceWithMarginFloor,
  calculateRfmWtpScore,
  sampleBetaValue,
  selectPaywallArmThompson,
  updateArmPosterior,
} from '../paywall-mab-engine';
import type { PaywallArm } from '@/seed/types/growth-triad-v5-types';

describe('Paywall MAB & Elasticity Engine', () => {
  it('calculates price elasticity correctly', () => {
    // Price rises from $100 to $120 (+20%), demand drops from 100 to 80 (-20%) -> eps = -1.0
    const eps = calculateElasticityEpsilon(100, 120, 100, 80);
    expect(eps).toBeCloseTo(-1.0, 2);
  });

  it('enforces margin floor in optimal price calculation', () => {
    const marginalCost = 20;
    // 60% gross margin floor = 20 / (1 - 0.6) = $50
    const price = calculateOptimalPriceWithMarginFloor(marginalCost, -2.5, 0.60);
    expect(price).toBeGreaterThanOrEqual(50);
  });

  it('computes RFM WTP score within [0, 1]', () => {
    const score = calculateRfmWtpScore({
      daysSinceLastActive: 2,
      loginCount30d: 25,
      mcuBurnRate30d: 800,
      maxMcuBaseline: 1000,
    });
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('draws sampled beta values within (0, 1)', () => {
    const val = sampleBetaValue(10, 90);
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(1);
  });

  it('selects highest expected revenue arm via Thompson sampling', () => {
    const arms: PaywallArm[] = [
      {
        id: 'arm-cheap',
        campaignId: 'camp-1',
        priceTier: 'TIER_50',
        priceUsd: 50,
        alphaSuccess: 5,
        betaFailure: 95,
        impressions: 100,
        conversions: 5,
        revenueUsd: 250,
        isActive: true,
      },
      {
        id: 'arm-premium',
        campaignId: 'camp-1',
        priceTier: 'TIER_150',
        priceUsd: 150,
        alphaSuccess: 40,
        betaFailure: 60,
        impressions: 100,
        conversions: 40,
        revenueUsd: 6000,
        isActive: true,
      },
    ];

    const selected = selectPaywallArmThompson(arms, 0.8);
    expect(selected).toBeDefined();
    expect(selected.id).toBe('arm-premium');
  });

  it('updates arm posterior statistics immutably', () => {
    const arm: PaywallArm = {
      id: 'arm-1',
      campaignId: 'camp-1',
      priceTier: 'TIER_100',
      priceUsd: 100,
      alphaSuccess: 2,
      betaFailure: 10,
      impressions: 12,
      conversions: 2,
      revenueUsd: 200,
      isActive: true,
    };

    const updated = updateArmPosterior(arm, true, 100);
    expect(updated.alphaSuccess).toBe(3);
    expect(updated.betaFailure).toBe(10);
    expect(updated.impressions).toBe(13);
    expect(updated.conversions).toBe(3);
    expect(updated.revenueUsd).toBe(300);
  });
});
