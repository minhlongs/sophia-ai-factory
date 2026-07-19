/**
 * Video Production Cost Engine
 *
 * Calculates EXACT operational costs for AI video production.
 * Uses real API pricing from HeyGen, ElevenLabs, OpenRouter.
 * Computes throughput capacity and ROI/ARR projections.
 */

import type { Tier } from '@/seed/types';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import {
  API_COSTS,
  MONTHLY_INFRA_COST,
  PRODUCTION_LIMITS,
} from './video-production-cost-constants';

export type {
  CostBreakdown,
  ThroughputResult,
  ROIProjection,
  ARRProjection,
} from './video-production-cost-constants';

export {
  API_COSTS,
  INFRA_COSTS,
  MONTHLY_INFRA_COST,
  PRODUCTION_LIMITS,
} from './video-production-cost-constants';

/**
 * Calculate variable cost per video (API costs only).
 */
export function calculateVariableCost(durationMin: number = 1): { heygen: number; elevenlabs: number; openrouter: number } {
  return {
    heygen: API_COSTS.heygen.perMinute * durationMin,
    elevenlabs: API_COSTS.elevenlabs.perScript,
    openrouter: API_COSTS.openrouter.perScript,
  };
}

/**
 * Calculate full cost breakdown for a given monthly volume.
 * Includes API subscriptions + cloud infrastructure.
 */
export function calculateCostBreakdown(videosPerMonth: number, durationMin: number = 1) {
  const components = calculateVariableCost(durationMin);
  const variableCostPerVideo = components.heygen + components.elevenlabs + components.openrouter;

  const monthlyFixedCosts =
    API_COSTS.heygen.monthlyFixed +
    API_COSTS.elevenlabs.monthlyFixed +
    API_COSTS.openrouter.monthlyFixed +
    MONTHLY_INFRA_COST;

  const fixedPerVideo = videosPerMonth > 0 ? monthlyFixedCosts / videosPerMonth : 0;
  const totalCostPerVideo = variableCostPerVideo + fixedPerVideo;

  return { variableCostPerVideo, monthlyFixedCosts, totalCostPerVideo, components };
}

/**
 * Calculate maximum production throughput.
 */
export function calculateThroughput(
  parallelJobs: number = PRODUCTION_LIMITS.maxParallelJobs,
  processingTimeMin: number = PRODUCTION_LIMITS.processingTimeMin,
) {
  const videosPerHour = Math.floor((60 / processingTimeMin) * parallelJobs);
  const videosPerDay = videosPerHour * PRODUCTION_LIMITS.operatingHoursPerDay;
  const videosPerMonth = videosPerDay * 30;
  const videosPerYear = videosPerDay * 365;

  return { videosPerHour, videosPerDay, videosPerMonth, videosPerYear };
}

/**
 * Calculate ROI projection for a specific tier.
 */
export function calculateTierROI(tier: Tier, videosPerMonth?: number) {
  const config = UNIFIED_TIERS[tier];
  const vpm = videosPerMonth ?? config.campaignsPerMonth;
  const cost = calculateCostBreakdown(vpm);

  const monthlyRevenue = config.price;
  const annualRevenue = monthlyRevenue * 12;
  const monthlyCost = (cost.variableCostPerVideo * vpm) + cost.monthlyFixedCosts;
  const annualCost = monthlyCost * 12;
  const monthlyProfit = monthlyRevenue - monthlyCost;
  const annualProfit = annualRevenue - annualCost;
  const marginPercent = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;
  const roiPercent = annualCost > 0 ? (annualProfit / annualCost) * 100 : 0;

  return {
    tier,
    tierName: config.name,
    monthlyRevenue,
    annualRevenue,
    monthlyCost: Math.round(monthlyCost * 100) / 100,
    annualCost: Math.round(annualCost * 100) / 100,
    monthlyProfit: Math.round(monthlyProfit * 100) / 100,
    annualProfit: Math.round(annualProfit * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
    roiPercent: Math.round(roiPercent * 10) / 10,
    videosPerMonth: vpm,
    costPerVideo: Math.round(cost.totalCostPerVideo * 100) / 100,
  };
}

/**
 * Calculate ARR projection for a customer mix.
 * Fixed API costs (HeyGen/ElevenLabs subscriptions) are shared across
 * all customers — they're factory costs, not per-customer costs.
 */
export function calculateARRProjection(customersByTier: Record<Tier, number>) {
  let totalARR = 0;
  let totalVariableCost = 0;
  let totalCustomers = 0;

  const monthlyFixedCosts =
    API_COSTS.heygen.monthlyFixed +
    API_COSTS.elevenlabs.monthlyFixed +
    API_COSTS.openrouter.monthlyFixed;

  for (const tier of Object.keys(customersByTier) as Tier[]) {
    const count = customersByTier[tier];
    if (count <= 0) continue;
    const config = UNIFIED_TIERS[tier];
    const vpm = config.campaignsPerMonth;
    const cost = calculateCostBreakdown(vpm);
    totalARR += config.price * 12 * count;
    totalVariableCost += cost.variableCostPerVideo * vpm * 12 * count;
    totalCustomers += count;
  }

  const totalAnnualCost = totalVariableCost + (monthlyFixedCosts * 12);
  const annualProfit = totalARR - totalAnnualCost;
  const marginPercent = totalARR > 0 ? (annualProfit / totalARR) * 100 : 0;

  return {
    customers: totalCustomers,
    arr: Math.round(totalARR),
    annualCost: Math.round(totalAnnualCost),
    annualProfit: Math.round(annualProfit),
    marginPercent: Math.round(marginPercent * 10) / 10,
  };
}
