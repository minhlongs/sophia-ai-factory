/**
 * Video Pipeline Net ROI & Unit Economics Calculator
 * Links rendering costs, BYOK tokens, and conversion revenues.
 * Layer: tree (domain algorithms) | LOC: < 200 | Zero :any
 * @module tree/analytics/roi-calculator
 */

import type { VideoFinancialAttribution } from '@/seed/types/video-analytics-types';

export const BASE_RENDER_COST_PER_MCU_USD = 0.005;

export interface RoiCalculationInput {
  mcuCost: number;
  costPerMcuUsd?: number;
  byokCostUsd?: number;
  additionalAssetCostUsd?: number;
  revenueUsd: number;
}

export function calculateFinancialAttribution(input: RoiCalculationInput): VideoFinancialAttribution {
  const mcuUnitCost = input.costPerMcuUsd ?? BASE_RENDER_COST_PER_MCU_USD;
  const mcuCostUsd = Math.max(0, input.mcuCost * mcuUnitCost);
  const byokCost = Math.max(0, input.byokCostUsd ?? 0);
  const assetCost = Math.max(0, input.additionalAssetCostUsd ?? 0);
  const totalCostUsd = Math.round((mcuCostUsd + byokCost + assetCost) * 100) / 100;
  const revenueUsd = Math.round(Math.max(0, input.revenueUsd) * 100) / 100;

  const netMarginUsd = Math.round((revenueUsd - totalCostUsd) * 100) / 100;

  const roiPercent = totalCostUsd > 0
    ? Math.round(((revenueUsd - totalCostUsd) / totalCostUsd) * 1000) / 10
    : revenueUsd > 0 ? 1000 : 0;

  const roiPerMcu = input.mcuCost > 0
    ? Math.round(((revenueUsd - byokCost) / input.mcuCost) * 10000) / 10000
    : 0;

  return {
    mcuCost: input.mcuCost,
    mcuCostUsd,
    byokCostUsd: byokCost,
    totalCostUsd,
    revenueUsd,
    netMarginUsd,
    roiPercent,
    roiPerMcu,
  };
}

export function aggregateChannelRoi(attributions: VideoFinancialAttribution[]): {
  totalRevenueUsd: number;
  totalCostUsd: number;
  totalNetMarginUsd: number;
  overallRoiPercent: number;
  avgRoiPerMcu: number;
} {
  if (attributions.length === 0) {
    return {
      totalRevenueUsd: 0,
      totalCostUsd: 0,
      totalNetMarginUsd: 0,
      overallRoiPercent: 0,
      avgRoiPerMcu: 0,
    };
  }

  const totalRevenue = attributions.reduce((sum, a) => sum + a.revenueUsd, 0);
  const totalCost = attributions.reduce((sum, a) => sum + a.totalCostUsd, 0);
  const totalNetMargin = Math.round((totalRevenue - totalCost) * 100) / 100;
  const overallRoiPercent = totalCost > 0
    ? Math.round(((totalRevenue - totalCost) / totalCost) * 1000) / 10
    : 0;

  const totalMcu = attributions.reduce((sum, a) => sum + a.mcuCost, 0);
  const avgRoiPerMcu = totalMcu > 0
    ? Math.round((totalRevenue / totalMcu) * 10000) / 10000
    : 0;

  return {
    totalRevenueUsd: Math.round(totalRevenue * 100) / 100,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    totalNetMarginUsd: totalNetMargin,
    overallRoiPercent,
    avgRoiPerMcu,
  };
}
