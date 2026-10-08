/**
 * Game-Theoretic Shapley Value Attribution & Profitability Engine
 * Layer: tree/growth-v13 | Max LOC: < 200 | Zero :any | Zero IO
 * @module tree/growth-v13/shapley-attribution
 */

import {
  TouchpointRecord,
  ShapleyAttributionItem,
  ShapleyAttributionResult,
} from '@/seed/types/growth-triad-v13';
import { SHAPLEY_CONFIG } from '@/seed/config/growth/bandit-weights';

export function calculateShapleyWeights(
  touchpoints: TouchpointRecord[],
  conversionTimestamp: number
): number[] {
  const n = touchpoints.length;
  if (n === 0) return [];
  if (n === 1) return [1.0];

  const halfLifeMs = SHAPLEY_CONFIG.TIME_DECAY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;
  const decayWeights = touchpoints.map((tp) => {
    const ageMs = Math.max(0, conversionTimestamp - tp.timestamp);
    return Math.pow(0.5, ageMs / halfLifeMs);
  });

  // Base Shapley cooperative position weights:
  // Discovery (first): 0.35, Closer (last): 0.40, Middle players: split remainder 0.25
  const positionWeights: number[] = new Array(n).fill(0);
  if (n === 2) {
    positionWeights[0] = 0.45;
    positionWeights[1] = 0.55;
  } else {
    positionWeights[0] = 0.35;
    positionWeights[n - 1] = 0.40;
    const middleShare = 0.25 / (n - 2);
    for (let i = 1; i < n - 1; i++) {
      positionWeights[i] = middleShare;
    }
  }

  // Combine cooperative position power with recency decay
  const combined = positionWeights.map((pw, i) => pw * decayWeights[i]);
  const sum = combined.reduce((acc, val) => acc + val, 0);

  return combined.map((val) => Number((val / (sum || 1)).toFixed(4)));
}

export function computeShapleyAttribution(
  conversionId: string,
  grossRevenueUsd: number,
  commissionUsd: number,
  touchpoints: TouchpointRecord[],
  conversionTimestamp: number
): ShapleyAttributionResult {
  if (touchpoints.length === 0) {
    return {
      conversionId,
      totalGrossRevenueUsd: grossRevenueUsd,
      totalCommissionUsd: commissionUsd,
      touchpoints: [],
      overallRoas: 0,
    };
  }

  const weights = calculateShapleyWeights(touchpoints, conversionTimestamp);
  let totalCostUsd = 0;

  const items: ShapleyAttributionItem[] = touchpoints.map((tp, idx) => {
    const weight = weights[idx] ?? 0;
    const attributedRevenue = Number((commissionUsd * weight).toFixed(2));
    const netProfit = Number((attributedRevenue - tp.mcuCostUsd).toFixed(2));
    const roas = tp.mcuCostUsd > 0 ? Number((attributedRevenue / tp.mcuCostUsd).toFixed(2)) : 0;
    totalCostUsd += tp.mcuCostUsd;

    return {
      videoManifestId: tp.videoManifestId,
      channelId: tp.channelId,
      platform: tp.platform,
      shapleyWeight: weight,
      attributedRevenueUsd: attributedRevenue,
      mcuCostUsd: tp.mcuCostUsd,
      netProfitUsd: netProfit,
      roas,
    };
  });

  const overallRoas = totalCostUsd > 0
    ? Number((commissionUsd / totalCostUsd).toFixed(2))
    : 0;

  return {
    conversionId,
    totalGrossRevenueUsd: grossRevenueUsd,
    totalCommissionUsd: commissionUsd,
    touchpoints: items,
    overallRoas,
  };
}
