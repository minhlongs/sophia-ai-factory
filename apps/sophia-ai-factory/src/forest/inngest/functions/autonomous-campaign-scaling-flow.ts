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
import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';
import {
  buildKillSwitchReport,
  dispatchWinningHookCampaign,
  type ScalingFlowExecutionReport,
  type ScalingOfferIdentity,
} from './autonomous-campaign-scaling-helpers';

export type { ScalingFlowExecutionReport };

export async function processAutonomousScaling(
  tenantId: string,
  metricsList: CampaignPerformanceMetrics[],
  offersByCampaign: Record<string, ScalingOfferIdentity> = {},
): Promise<ScalingFlowExecutionReport> {
  // Fail closed: an unreadable halt state must not release a spending job.
  const killState = await getAffiliateKillSwitchState(tenantId);
  const killSwitchActive = killState.active || !killState.known;
  if (killSwitchActive) {
    logger.warn('processAutonomousScaling: Emergency Kill Switch active - pausing video scaling', {
      tenantId,
    });
    return buildKillSwitchReport(tenantId, metricsList);
  }

  let scaledCount = 0;
  let maintainedCount = 0;
  let prunedCount = 0;
  let dispatchedCount = 0;
  let notDispatchedReason: string | undefined;
  const decisions: ScalingDecision[] = [];

  for (const metrics of metricsList) {
    const decision = evaluateCampaignScaling(metrics);
    decisions.push(decision);

    if (decision.action === 'SCALE_AGGRESSIVE') {
      scaledCount++;
      logger.info('processAutonomousScaling: triggering aggressive scale', {
        campaignId: decision.campaignId,
        hookId: decision.campaignId,
        targetDailyVideos: decision.recommendedDailyVideos,
      });

      const dispatch = await dispatchWinningHookCampaign(
        tenantId,
        metrics,
        decision,
        offersByCampaign[decision.campaignId],
      );
      if (dispatch.dispatched) dispatchedCount++;
      else notDispatchedReason = dispatch.reason;
    } else if (decision.action === 'KILL_PRUNE') {
      prunedCount++;
      logger.info('processAutonomousScaling: pruned underperforming hook', {
        campaignId: decision.campaignId,
        hookId: decision.campaignId,
        action: decision.action,
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
    killSwitchActive: false,
    dispatchedCount,
    ...(notDispatchedReason ? { notDispatchedReason } : {}),
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
    const { tenantId, evaluatedMetrics, offersByCampaign } = event.data;

    const report = await step.run('evaluate-and-scale-campaigns', async () => {
      return await processAutonomousScaling(tenantId, evaluatedMetrics, offersByCampaign ?? {});
    });

    // EVALUATED, not SUCCESS: a decision without a verified offer/approval
    // emits no render event and must not be reported as a produced campaign.
    return {
      status: 'EVALUATED',
      report,
    };
  },
);
