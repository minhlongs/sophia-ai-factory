/**
 * @file paywall-mab-engine.test.ts
 * @description Zero-mock unit tests for Paywall MAB & Price Elasticity Engine with Track B Sparse-Data Guard
 * @layer tree
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateElasticityEpsilon,
  calculateOptimalPriceWithMarginFloor,
  calculateRfmWtpScore,
  evaluatePaywallArmsSparseDataGate,
  sampleBetaValue,
  selectPaywallArmThompson,
  updateArmPosterior,
} from '../paywall-mab-engine';
import type { PaywallArm } from '@/seed/types/growth-triad-v5-types';

describe('Paywall MAB & Elasticity Engine', () => {
  it('calculates price elasticity correctly', () => {
    const eps = calculateElasticityEpsilon(100, 120, 100, 80);
    expect(eps).toBeCloseTo(-1.0, 2);
  });

  it('enforces margin floor in optimal price calculation', () => {
    const marginalCost = 20;
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

  it('enforces Track B sparse-data guard and selects deterministic baseline when conversions === 0', () => {
    const arms: PaywallArm[] = [
      {
        id: 'arm-enterprise',
        campaignId: 'camp-zero',
        priceTier: 'ENTERPRISE',
        priceUsd: 799,
        alphaSuccess: 1,
        betaFailure: 1,
        impressions: 0,
        conversions: 0,
        revenueUsd: 0,
        isActive: true,
      },
      {
        id: 'arm-basic',
        campaignId: 'camp-zero',
        priceTier: 'BASIC',
        priceUsd: 199,
        alphaSuccess: 1,
        betaFailure: 1,
        impressions: 0,
        conversions: 0,
        revenueUsd: 0,
        isActive: true,
      },
    ];

    const gate = evaluatePaywallArmsSparseDataGate(arms);
    expect(gate.mode).toBe('deterministic_rule_based');
    expect(gate.allowThompsonSampling).toBe(false);

    const randomSpy = vi.spyOn(Math, 'random');
    const selected = selectPaywallArmThompson(arms, 0.9);
    expect(selected.id).toBe('arm-basic');
    expect(randomSpy).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it('selects highest empirical expected revenue arm deterministically under sparse traffic', () => {
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
    expect(selected.id).toBe('arm-premium');
  });

  it('unlocks Thompson Sampling when >=100 conversions and >=1,000 impressions per arm', () => {
    const arms: PaywallArm[] = [
      {
        id: 'arm-basic',
        campaignId: 'camp-dense',
        priceTier: 'BASIC',
        priceUsd: 199,
        alphaSuccess: 30,
        betaFailure: 1170,
        impressions: 1200,
        conversions: 30,
        revenueUsd: 5970,
        isActive: true,
      },
      {
        id: 'arm-pro',
        campaignId: 'camp-dense',
        priceTier: 'PREMIUM',
        priceUsd: 399,
        alphaSuccess: 90,
        betaFailure: 1110,
        impressions: 1200,
        conversions: 90,
        revenueUsd: 35910,
        isActive: true,
      },
    ];

    const gate = evaluatePaywallArmsSparseDataGate(arms, 45);
    expect(gate.mode).toBe('thompson_half_kelly');
    expect(gate.allowThompsonSampling).toBe(true);

    const selected = selectPaywallArmThompson(arms, 0.85, 45);
    expect(selected.id).toBe('arm-pro');
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
