/**
 * Video Production ROI & ARR Projections
 * @module land/billing/video-production-projections
 */

import type { Tier } from '@/seed/types';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { API_COSTS } from './video-production-cost-constants';
import { calculateCostBreakdown } from './video-production-cost-engine';

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
