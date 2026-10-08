/**
 * @file paywall-mab-engine.ts
 * @description Pure deterministic algorithm for Dynamic LTV Price Elasticity & Thompson Sampling Paywall
 * @layer tree
 */

import type { PaywallArm, RfmWtpInput } from '@/seed/types/growth-triad-v5-types';

export function calculateElasticityEpsilon(
  p0: number,
  p1: number,
  q0: number,
  q1: number
): number {
  if (p0 <= 0 || q0 <= 0 || p0 === p1) return -1.0;
  const pctDeltaQ = (q1 - q0) / q0;
  const pctDeltaP = (p1 - p0) / p0;
  return pctDeltaQ / pctDeltaP;
}

export function calculateOptimalPriceWithMarginFloor(
  marginalCost: number,
  elasticity: number,
  minMarginPct = 0.60
): number {
  if (marginalCost <= 0) return 10;
  const marginFloor = marginalCost / (1 - minMarginPct);
  if (elasticity >= -1) return marginFloor;
  const unconstrainedPrice = marginalCost / (1 + 1 / elasticity);
  return Math.max(marginFloor, unconstrainedPrice);
}

export function calculateRfmWtpScore(input: RfmWtpInput): number {
  const recencyDampener = Math.exp(-0.02 * input.daysSinceLastActive);
  const frequencyScore = Math.min(1.0, Math.log(1 + input.loginCount30d) / Math.log(31));
  const baseline = input.maxMcuBaseline > 0 ? input.maxMcuBaseline : 1000;
  const monetaryBurnScore = Math.min(1.0, input.mcuBurnRate30d / baseline);

  const rawScore = 0.35 * recencyDampener + 0.30 * frequencyScore + 0.35 * monetaryBurnScore;
  return Math.max(0.0, Math.min(1.0, rawScore));
}

export function sampleBetaValue(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) return 0.5;
  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
  const std = Math.sqrt(variance);

  // Box-Muller standard normal draw
  const u1 = Math.max(1e-6, Math.random());
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

  const sample = mean + z0 * std;
  return Math.max(0.001, Math.min(0.999, sample));
}

export function selectPaywallArmThompson(
  arms: PaywallArm[],
  rfmWtpScore: number
): PaywallArm {
  const activeArms = arms.filter((a) => a.isActive);
  if (activeArms.length === 0) {
    throw new Error('No active paywall arms available');
  }

  let bestArm = activeArms[0];
  let maxExpectedRevenue = -1;

  for (const arm of activeArms) {
    const priorAdjustment = 1.0 + (rfmWtpScore - 0.5) * 0.2;
    const effectiveAlpha = Math.max(1.0, arm.alphaSuccess * priorAdjustment);
    const sampledConversionProb = sampleBetaValue(effectiveAlpha, arm.betaFailure);
    const expectedRevenue = sampledConversionProb * arm.priceUsd;

    if (expectedRevenue > maxExpectedRevenue) {
      maxExpectedRevenue = expectedRevenue;
      bestArm = arm;
    }
  }

  return bestArm;
}

export function updateArmPosterior(
  arm: PaywallArm,
  converted: boolean,
  revenueUsd: number
): PaywallArm {
  return {
    ...arm,
    alphaSuccess: arm.alphaSuccess + (converted ? 1 : 0),
    betaFailure: arm.betaFailure + (converted ? 0 : 1),
    impressions: arm.impressions + 1,
    conversions: arm.conversions + (converted ? 1 : 0),
    revenueUsd: arm.revenueUsd + revenueUsd,
  };
}
