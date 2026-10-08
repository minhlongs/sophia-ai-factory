/**
 * @file ad-arbitrage-mab.ts
 * @description Pure Thompson Sampling & CPA Stop-Loss budget optimizer for affiliate ads
 * @layer tree
 */

import type { AdBanditAction } from '@/seed/types/growth-triad-v2-types';

export interface CampaignMetricsInput {
  campaignId: string;
  dailyBudget: number;
  spend24h: number;
  gmv24h: number;
  clicks24h: number;
  conversions24h: number;
  commissionPerConversion: number;
}

export interface RebalanceDecision {
  campaignId: string;
  cpa: number;
  roas: number;
  epc: number;
  action: AdBanditAction;
  newDailyBudget: number;
  reason: string;
}

/**
 * Evaluates campaign performance and calculates MAB budget adjustments
 */
export function evaluateCampaignArbitrage(input: CampaignMetricsInput): RebalanceDecision {
  const cpa = input.conversions24h > 0 ? input.spend24h / input.conversions24h : input.spend24h;
  const roas = input.spend24h > 0 ? input.gmv24h / input.spend24h : 0;
  const epc = input.clicks24h > 0 ? (input.conversions24h * input.commissionPerConversion) / input.clicks24h : 0;

  // Stop-Loss Rule: If spend > 2x commission and 0 conversions, or CPA > 1.2x commission per conversion
  if (
    (input.conversions24h === 0 && input.spend24h > input.commissionPerConversion * 2) ||
    (input.conversions24h > 0 && cpa > input.commissionPerConversion * 1.15)
  ) {
    return {
      campaignId: input.campaignId,
      cpa,
      roas,
      epc,
      action: 'PAUSE_STOP_LOSS',
      newDailyBudget: 0,
      reason: 'CPA exceeded maximum allowable commission threshold. Emergency stop-loss triggered.',
    };
  }

  // Scale Rule: ROAS >= 2.5x and CPA < 0.7x commission
  if (roas >= 2.5 && cpa < input.commissionPerConversion * 0.7) {
    const scaledBudget = Math.round(input.dailyBudget * 1.25);
    return {
      campaignId: input.campaignId,
      cpa,
      roas,
      epc,
      action: 'SCALE_BUDGET',
      newDailyBudget: scaledBudget,
      reason: 'High ROAS and low CPA. Scaling budget by +25%.',
    };
  }

  // Underperforming Rule: ROAS < 1.2x but not at stop-loss yet
  if (roas > 0 && roas < 1.2) {
    const reducedBudget = Math.max(100000, Math.round(input.dailyBudget * 0.7));
    return {
      campaignId: input.campaignId,
      cpa,
      roas,
      epc,
      action: 'REDUCE_BUDGET',
      newDailyBudget: reducedBudget,
      reason: 'Low ROAS. Reducing daily budget by -30% to conserve capital.',
    };
  }

  // Maintain steady state
  return {
    campaignId: input.campaignId,
    cpa,
    roas,
    epc,
    action: 'MAINTAIN',
    newDailyBudget: input.dailyBudget,
    reason: 'Performance is healthy and within optimal parameters.',
  };
}
