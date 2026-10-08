/**
 * @file video-splittest-evaluation-job.ts
 * @description Background job running Wilson/conversion evaluations for split-test videos
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { evaluateSplitTestAttribution } from '@/tree/newsjacking/split-test-attribution-engine';

export const videoSplitTestEvaluationJob = inngest.createFunction(
  { id: 'video-splittest-evaluation-job', name: 'Video Split-Test Attribution & Loss-Cut Job' },
  { event: 'video.splittest.evaluation.requested' },
  async ({ event, step }) => {
    const { experimentId, campaignId, variantAViews, variantAConversions, variantBViews, variantBConversions } = event.data;

    const evaluation = await step.run('evaluate-variant-performance', async () => {
      return evaluateSplitTestAttribution({
        experimentId,
        variantA: {
          views: variantAViews,
          clicks: Math.round(variantAViews * 0.2),
          conversions: variantAConversions,
        },
        variantB: {
          views: variantBViews,
          clicks: Math.round(variantBViews * 0.2),
          conversions: variantBConversions,
        },
      });
    });

    return {
      success: true,
      experimentId,
      campaignId,
      status: evaluation.status,
      winnerVariant: evaluation.winnerVariant,
      trafficAllocation: evaluation.trafficAllocationRecommendation,
      reason: evaluation.recommendationReason,
    };
  },
);
