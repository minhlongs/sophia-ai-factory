/**
 * @file epc-velocity-engine.ts
 * @description Pure deterministic engine for Affiliate 7d Rolling EPC and Commission Tier Escalation
 * @layer tree
 */

import type { AffiliateEpcInput, AffiliateTier } from '@/seed/types/growth-triad-v4-types';

export interface EpcCalculationResult {
  epcUsd: number;
  conversionRate: number;
  commissionTier: AffiliateTier;
  commissionSplitPercentage: number;
}

export function calculateEpcMetrics(input: AffiliateEpcInput): EpcCalculationResult {
  const safeClicks = Math.max(1, input.clicks7d);
  const epcUsd = Math.round((input.grossRevenueUsd / safeClicks) * 100) / 100;
  const conversionRate = Math.round((input.conversions7d / safeClicks) * 10000) / 10000;

  let commissionTier: AffiliateTier = 'STANDARD';
  let commissionSplitPercentage = 10;

  if (epcUsd >= 2.5) {
    commissionTier = 'DIAMOND_ELITE';
    commissionSplitPercentage = 40;
  } else if (epcUsd >= 1.2) {
    commissionTier = 'GOLD_SCALE';
    commissionSplitPercentage = 30;
  } else if (epcUsd >= 0.5) {
    commissionTier = 'SILVER_SCALE';
    commissionSplitPercentage = 20;
  }

  return {
    epcUsd,
    conversionRate,
    commissionTier,
    commissionSplitPercentage,
  };
}

export function generateAffiliateSubId(
  campaignId: string,
  userId: string,
  trafficSource: string
): string {
  const cleanSource = trafficSource.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `sub_${campaignId}_${userId.slice(0, 8)}_${cleanSource}`;
}
