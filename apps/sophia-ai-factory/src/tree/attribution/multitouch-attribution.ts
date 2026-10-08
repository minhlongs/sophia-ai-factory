/**
 * @file multitouch-attribution.ts
 * @description Pure multi-touch attribution algorithms (first-touch, last-touch, time-decay) and LTV/CAC calculation
 * @layer tree
 */

import type { AttributionModel } from '@/seed/types/growth-triad-v3-types';

export interface RawTouchpoint {
  channel: string;
  timestamp: number;
}

export interface WeightedTouchpoint {
  channel: string;
  weightPercentage: number;
  attributedGmv: number;
}

/**
 * Calculates channel attribution weights given an array of touchpoints and total GMV
 */
export function calculateAttributionWeights(
  touchpoints: RawTouchpoint[],
  totalGmv: number,
  model: AttributionModel = 'TIME_DECAY'
): WeightedTouchpoint[] {
  if (touchpoints.length === 0 || totalGmv <= 0) return [];

  // Sort ascending by timestamp
  const sorted = [...touchpoints].sort((a, b) => a.timestamp - b.timestamp);

  if (model === 'FIRST_TOUCH') {
    return sorted.map((t, idx) => ({
      channel: t.channel,
      weightPercentage: idx === 0 ? 100 : 0,
      attributedGmv: idx === 0 ? totalGmv : 0,
    }));
  }

  if (model === 'LAST_TOUCH') {
    const lastIdx = sorted.length - 1;
    return sorted.map((t, idx) => ({
      channel: t.channel,
      weightPercentage: idx === lastIdx ? 100 : 0,
      attributedGmv: idx === lastIdx ? totalGmv : 0,
    }));
  }

  // TIME_DECAY: Half-life decay based on recency to conversion
  // Weight w_i = 2^((t_i - t_conv) / halfLife), normalized
  const tConv = sorted[sorted.length - 1].timestamp;
  const halfLifeMs = 7 * 24 * 3600 * 1000; // 7-day half life

  const rawWeights = sorted.map((t) => {
    const diff = t.timestamp - tConv;
    return Math.pow(2, diff / halfLifeMs);
  });

  const sumWeights = rawWeights.reduce((acc, w) => acc + w, 0);

  return sorted.map((t, idx) => {
    const pct = sumWeights > 0 ? (rawWeights[idx] / sumWeights) * 100 : 0;
    const roundedPct = Math.round(pct * 100) / 100;
    return {
      channel: t.channel,
      weightPercentage: roundedPct,
      attributedGmv: Math.round(((totalGmv * roundedPct) / 100) * 100) / 100,
    };
  });
}

/**
 * Computes LTV/CAC ratio: Customer Lifetime Value / Customer Acquisition Cost
 */
export function calculateLtvCacRatio(customerLifetimeValue: number, totalAcquisitionCost: number): number {
  if (totalAcquisitionCost <= 0) {
    return customerLifetimeValue > 0 ? 99.9 : 0;
  }
  return Math.round((customerLifetimeValue / totalAcquisitionCost) * 100) / 100;
}
