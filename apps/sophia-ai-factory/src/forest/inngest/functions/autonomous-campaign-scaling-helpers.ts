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
    })),
    killSwitchActive: true,
  };
}

export async function dispatchWinningHookCampaign(
  tenantId: string,
  metrics: CampaignPerformanceMetrics,
  decision: ScalingDecision,
): Promise<void> {
  await inngest.send({
    name: 'niche.video.campaign.requested',
    data: {
      userId: `tenant_${tenantId}`,
      campaignId: decision.campaignId,
      niche: metrics.niche === 'ecommerce_tiktok' ? 'saas_global' : metrics.niche,
      blueprintId: 'saas_problem_agitation_solution',
      productName: `Winning Hook: ${decision.hookName}`,
      productUrl: 'https://sophia.agencyos.network/affiliate',
      targetAudience: 'High Converting Demographic',
      jurisdiction: 'GLOBAL',
      affiliateCode: 'SCALE_WINNER',
      subId: `scale_${Date.now()}`,
      locale: 'en',
    },
  });
}
