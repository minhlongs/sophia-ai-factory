/**
 * Autonomous Video Pipeline Job
 *
 * Inngest function for autonomous video pipeline execution.
 * Deterministic synthesis: Blueprints -> A/B Hooks -> B-Roll -> Audio/SFX -> Captions -> Compliance -> Distribution.
 *
 * Layer: forest/inngest/functions (Reusable Infrastructure Orchestrator)
 * @module forest/inngest/functions/autonomous-video-pipeline-job
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { runAutonomousVideoPipeline } from '@/forest/video/autonomous-video-orchestrator';
import type { PipelineNiche } from '@/forest/video/video-pipeline-types';
import { dispatchSocialDistributionForPipeline } from './autonomous-video-pipeline-distribution';

export interface AutonomousVideoJobEventData {
  campaignId: string;
  userId?: string;
  autoPublish?: boolean;
  videoUrl?: string;
  niche: PipelineNiche;
  productName: string;
  productUrl: string;
  productDescription: string;
  targetDurationSeconds?: number;
  affiliateBaseUrl: string;
  targetPlatforms?: ('youtube_shorts' | 'tiktok' | 'instagram_reels')[];
}

export interface InngestStepHandler {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
}

export async function processAutonomousVideoPipelineJob({
  event,
  step,
}: {
  event: { data: AutonomousVideoJobEventData };
  step: InngestStepHandler;
}) {
  const data = event.data;

  logger.info('autonomousVideoPipelineJob: starting execution', {
    campaignId: data.campaignId,
    niche: data.niche,
    productName: data.productName,
  });

  // Step 1: Execute composite pipeline orchestration deterministically
  const summary = await step.run('execute-pipeline-synthesis', async () => {
    return runAutonomousVideoPipeline({
      campaignId: data.campaignId,
      niche: data.niche,
      productName: data.productName,
      productUrl: data.productUrl,
      productDescription: data.productDescription,
      targetDurationSeconds: data.targetDurationSeconds ?? 15.0,
      affiliateBaseUrl: data.affiliateBaseUrl,
      targetPlatforms: data.targetPlatforms,
    });
  });

  logger.info('autonomousVideoPipelineJob: pipeline execution completed', {
    campaignId: summary.campaignId,
    manifestId: summary.manifest.manifestId,
    hookVariants: summary.hookVariantsGeneratedCount,
  });

  // Step 2: Bridge to Social Direct Publisher if userId is provided
  const distribution = await step.run('resolve-social-distribution', async () => {
    return dispatchSocialDistributionForPipeline(data, summary);
  });

  return {
    status: 'COMPLETED',
    summary,
    distribution,
  };
}

export const autonomousVideoPipelineJob = inngest.createFunction(
  {
    id: 'autonomous-video-pipeline-job',
    name: 'Autonomous Video Pipeline Job',
    retries: 2,
  },
  { event: 'autonomous.video.pipeline.requested' },
  processAutonomousVideoPipelineJob,
);
