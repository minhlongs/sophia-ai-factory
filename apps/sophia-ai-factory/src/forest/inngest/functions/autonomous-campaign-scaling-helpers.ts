/**
 * Helper builders and event dispatchers for Autonomous Campaign Scaling Flow.
 * Layer: forest/inngest/functions (Infrastructure Orchestrator)
 * @module forest/inngest/functions/autonomous-campaign-scaling-helpers
 */

import { inngest } from '@/seed/inngest/client';
import type {
  CampaignPerformanceMetrics,
  ScalingDecision,
} from '@/tree/affiliate/scaling/auto-campaign-scaler';

export interface ScalingFlowExecutionReport {
  tenantId: string;
  totalEvaluated: number;
  scaledCount: number;
  maintainedCount: number;
  prunedCount: number;
  decisions: ScalingDecision[];
  killSwitchActive?: boolean;
  /** Number of render events actually emitted (not just "winners" counted). */
  dispatchedCount?: number;
  notDispatchedReason?: string;
}

export function buildKillSwitchReport(
  tenantId: string,
  metricsList: CampaignPerformanceMetrics[],
): ScalingFlowExecutionReport {
  return {
    tenantId,
    totalEvaluated: metricsList.length,
    scaledCount: 0,
    maintainedCount: metricsList.length,
    prunedCount: 0,
    decisions: metricsList.map((m) => ({
      campaignId: m.campaignId,
      hookName: m.hookName,
      ctrPercent: (m.clicks / Math.max(m.impressions, 1)) * 100,
      cvrPercent: (m.conversions / Math.max(m.clicks, 1)) * 100,
      epcCents: Math.round(m.totalEarningsCents / Math.max(m.clicks, 1)),
      recommendedDailyVideos: 0,
      action: 'MAINTAIN_STEADY',
      reason: 'Emergency Kill Switch is currently active across platform/tenant',
      contributionCents: null,
      costKnown: false,
    })),
    killSwitchActive: true,
  };
}

/** Verified identity required before a scaling decision may spend money. */
export interface ScalingOfferIdentity {
  offerId: string;
  operatorUserId: string;
  productName: string;
  productUrl: string;
  niche: 'saas_global' | 'crypto_global';
  jurisdiction: string;
  locale: 'en' | 'vi';
  approvalId: string;
  approvalHash: string;
  termsVerified: boolean;
  maxRenderCostCents: number;
}

/**
 * Only dispatches a new render when the winning hook is bound to a REAL,
 * verified offer and an existing approval. The old implementation invented a
 * `Winning Hook: …` product name, pointed at Sophia's own marketing URL and
 * synthesized `tenant_<id>` as a user id — a fake offer that could spend money.
 */
export async function dispatchWinningHookCampaign(
  tenantId: string,
  metrics: CampaignPerformanceMetrics,
  decision: ScalingDecision,
  offer?: ScalingOfferIdentity,
): Promise<{ dispatched: boolean; reason?: string }> {
  const missing =
    !offer ||
    !offer.offerId || !offer.operatorUserId || !offer.productUrl ||
    !offer.approvalId || !offer.approvalHash || offer.termsVerified !== true ||
    !Number.isFinite(offer.maxRenderCostCents) || offer.maxRenderCostCents <= 0;
  if (missing) {
    return { dispatched: false, reason: 'VERIFIED_OFFER_AND_APPROVAL_REQUIRED' };
  }
  const verified = offer as ScalingOfferIdentity;

  await inngest.send({
    name: 'niche.video.campaign.requested',
    data: {
      userId: verified.operatorUserId,
      tenantId,
      offerId: verified.offerId,
      termsVerified: true,
      approvalId: verified.approvalId,
      approvalHash: verified.approvalHash,
      maxRenderCostCents: verified.maxRenderCostCents,
      idempotencyKey: `${tenantId}:scale:${decision.campaignId}:${metrics.observedWindowHours ?? 'na'}`,
      campaignId: decision.campaignId,
      niche: verified.niche,
      blueprintId: verified.niche === 'crypto_global'
        ? 'crypto_fee_discount_signup_bonus'
        : 'saas_problem_agitation_solution',
      productName: verified.productName,
      productUrl: verified.productUrl,
      jurisdiction: verified.jurisdiction,
      locale: verified.locale,
    },
  });
  return { dispatched: true };
}
