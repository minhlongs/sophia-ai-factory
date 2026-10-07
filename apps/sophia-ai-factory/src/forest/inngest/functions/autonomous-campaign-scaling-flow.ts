/**
 * Autonomous Campaign Scaling Inngest Workflow
 *
 * Listens for 'autonomous.campaign.scaling.requested' events, runs the
 * domain auto-campaign-scaler on all campaign metrics, and triggers:
 * - Aggressive video production fanout for winners (4 videos/day)
 * - Pruning and notifications for dead hooks (0 videos/day)
 *
 * Layer: forest/inngest/functions (Infrastructure Orchestrator)
 * @module forest/inngest/functions/autonomous-campaign-scaling-flow
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  evaluateCampaignScaling,
  type CampaignPerformanceMetrics,
  type ScalingDecision,
} from '@/tree/affiliate/scaling/auto-campaign-scaler';

export interface ScalingFlowExecutionReport {
  tenantId: string;
  totalEvaluated: number;
  scaledCount: number;
  maintainedCount: number;
  prunedCount: number;
  decisions: ScalingDecision[];
}

export async function processAutonomousScaling(
  tenantId: string,
  metricsList: CampaignPerformanceMetrics[],
): Promise<ScalingFlowExecutionReport> {
  let scaledCount = 0;
  let maintainedCount = 0;
  let prunedCount = 0;
  const decisions: ScalingDecision[] = [];

  for (const metrics of metricsList) {
    const decision = evaluateCampaignScaling(metrics);
    decisions.push(decision);

    if (decision.action === 'SCALE_AGGRESSIVE') {
      scaledCount++;
      logger.info('processAutonomousScaling: triggering aggressive scale', {
        campaignId: decision.campaignId,
        hook: decision.hookName,
        targetDailyVideos: decision.recommendedDailyVideos,
      });

      // Dispatch video generation for aggressive scaling winners
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
    } else if (decision.action === 'KILL_PRUNE') {
      prunedCount++;
      logger.info('processAutonomousScaling: pruned underperforming hook', {
        campaignId: decision.campaignId,
        hook: decision.hookName,
        reason: decision.reason,
      });
    } else {
      maintainedCount++;
    }
  }

  return {
    tenantId,
    totalEvaluated: metricsList.length,
    scaledCount,
    maintainedCount,
    prunedCount,
    decisions,
  };
}

export const autonomousCampaignScalingFlow = inngest.createFunction(
  {
    id: 'affiliate-autonomous-campaign-scaling-flow',
    name: 'Affiliate: Autonomous Campaign Scaling & Frequency Manager Flow',
    retries: 2,
  },
  { event: 'autonomous.campaign.scaling.requested' },
  async ({ event, step }) => {
    const { tenantId, evaluatedMetrics } = event.data;

    const report = await step.run('evaluate-and-scale-campaigns', async () => {
      return await processAutonomousScaling(tenantId, evaluatedMetrics);
    });

    return {
      status: 'SUCCESS',
      report,
    };
  },
);
