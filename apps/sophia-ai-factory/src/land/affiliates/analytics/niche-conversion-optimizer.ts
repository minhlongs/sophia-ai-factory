/**
 * Niche Conversion Optimizer
 *
 * Evaluates Hook A/B testing performance using Upper Confidence Bound (UCB1)
 * Multi-Armed Bandit algorithm to discover and scale winning video creatives.
 *
 * Layer: land/affiliates/analytics (Business Workflow)
 * @module land/affiliates/analytics/niche-conversion-optimizer
 */

import type {
  HookPerformanceMetric,
  HookVariant,
} from '@/tree/video/ab-testing/hook-variant-types';

export interface RawVariantTelemetry {
  variantId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  commissionCents: number;
}

export interface OptimizationRankingResult {
  rankedMetrics: HookPerformanceMetric[];
  winnerVariantId: string;
  explorationMode: boolean;
  totalImpressions: number;
  totalCommissionUsd: number;
}

/**
 * Calculates UCB1 score for balancing exploration vs exploitation:
 * UCB1 = (Earnings / Impressions) + sqrt(2 * ln(Total_Impressions) / Impressions)
 */
function calculateUcbScore(
  variantImpressions: number,
  totalImpressions: number,
  earningsUsd: number,
): number {
  if (variantImpressions === 0) return Infinity;
  const averageReward = earningsUsd / variantImpressions;
  const explorationBonus = Math.sqrt((2 * Math.log(Math.max(totalImpressions, 1))) / variantImpressions);
  return averageReward + explorationBonus;
}

export function rankHookVariants(
  variants: HookVariant[],
  telemetryList: RawVariantTelemetry[],
): OptimizationRankingResult {
  const totalImpressions = telemetryList.reduce((sum, t) => sum + t.impressions, 0);
  const totalCommissionCents = telemetryList.reduce((sum, t) => sum + t.commissionCents, 0);

  const telemetryMap = new Map<string, RawVariantTelemetry>();
  for (const t of telemetryList) {
    telemetryMap.set(t.variantId, t);
  }

  const metrics: HookPerformanceMetric[] = variants.map((v) => {
    const raw = telemetryMap.get(v.id) || {
      variantId: v.id,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      commissionCents: 0,
    };

    const imps = raw.impressions;
    const clicks = raw.clicks;
    const convs = raw.conversions;
    const ctr = imps > 0 ? (clicks / imps) * 100 : 0;
    const conversionRate = clicks > 0 ? (convs / clicks) * 100 : 0;
    const earningsUsd = raw.commissionCents / 100;

    const score = calculateUcbScore(imps, totalImpressions, earningsUsd);

    return {
      variantId: v.id,
      impressions: imps,
      clicks,
      conversions: convs,
      commissionCents: raw.commissionCents,
      ctr: Math.round(ctr * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      score: isFinite(score) ? Math.round(score * 1000) / 1000 : 999,
    };
  });

  // Sort descending by UCB score (or estimated retention if no telemetry yet)
  metrics.sort((a, b) => b.score - a.score);

  const winner = metrics[0]?.variantId || variants[0]?.id || 'hkv_1';
  const explorationMode = totalImpressions < 500;

  return {
    rankedMetrics: metrics,
    winnerVariantId: winner,
    explorationMode,
    totalImpressions,
    totalCommissionUsd: totalCommissionCents / 100,
  };
}
