/**
 * @file sample-gate-fsm.ts
 * @description Pure evaluation and state transitions for TikTok Shop sample gating & commission tiers
 * @layer tree
 */

import type { SampleGateStatus, CommissionTier } from '@/seed/types/growth-triad-v3-types';

export interface CreatorMetricsInput {
  followerCount: number;
  rollingGmv30d: number;
  engagementRate: number;
  attributedSalesCount: number;
}

/**
 * Evaluates whether a creator qualifies for automated free sample dispatch
 */
export function evaluateSampleGate(metrics: CreatorMetricsInput): {
  status: 'AUTO_APPROVED' | 'MANUAL_REVIEW' | 'REJECTED_LOW_METRICS';
  reason: string;
} {
  // Auto-approve: GMV >= $5,000 OR (Followers >= 50,000 and Engagement >= 5%)
  if (metrics.rollingGmv30d >= 5000) {
    return {
      status: 'AUTO_APPROVED',
      reason: 'High GMV benchmark met (>= $5,000 30d rolling)',
    };
  }

  if (metrics.followerCount >= 50000 && metrics.engagementRate >= 0.05) {
    return {
      status: 'AUTO_APPROVED',
      reason: 'Audience scale and engagement benchmark met',
    };
  }

  // Borderline: Followers >= 10,000 and Engagement >= 2%
  if (metrics.followerCount >= 10000 && metrics.engagementRate >= 0.02) {
    return {
      status: 'MANUAL_REVIEW',
      reason: 'Moderate reach, pending human brand alignment review',
    };
  }

  return {
    status: 'REJECTED_LOW_METRICS',
    reason: 'Followers or engagement rate below minimum threshold for free sample dispatch',
  };
}

/**
 * Calculates dynamic commission tier based on attributed lifetime sales
 */
export function resolveCommissionTier(attributedSalesCount: number): CommissionTier {
  if (attributedSalesCount >= 100) {
    return 'TIER_3_ELITE'; // e.g. 25% commission
  }
  if (attributedSalesCount >= 25) {
    return 'TIER_2_GROWTH'; // e.g. 20% commission
  }
  return 'TIER_1_STANDARD'; // e.g. 15% commission
}
