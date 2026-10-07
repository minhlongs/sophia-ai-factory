/**
 * Autonomous Video Pipeline Job
 *
 * Inngest function for autonomous video pipeline execution.
 * Triggers full deterministic synthesis: Blueprints -> A/B Hooks -> B-Roll -> Audio/SFX -> Captions -> Compliance -> Syndication.
 *
 * Layer: forest/inngest/functions (Reusable Infrastructure Orchestrator)
 * @module forest/inngest/functions/autonomous-video-pipeline-job
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { runAutonomousVideoPipeline } from '@/forest/video/autonomous-video-orchestrator';
import type { PipelineNiche } from '@/forest/video/video-pipeline-types';

export interface AutonomousVideoJobEventData {
  campaignId: string;
  niche: PipelineNiche;
  productName: string;
  productUrl: string;
  productDescription: string;
  targetDurationSeconds?: number;
  affiliateBaseUrl: string;
  targetPlatforms?: ('youtube_shorts' | 'tiktok' | 'instagram_reels')[];
}

export const autonomousVideoPipelineJob = inngest.createFunction(
  {
    id: 'autonomous-video-pipeline-job',
    name: 'Autonomous Video Pipeline Job',
    retries: 2,
  },
  { event: 'autonomous.video.pipeline.requested' },
  async ({ event, step }) => {
    const data = event.data as AutonomousVideoJobEventData;

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
      brollCuts: summary.totalBrollCuts,
      sfxCues: summary.totalSfxCues,
    });

    return {
      status: 'COMPLETED',
      summary,
    };
  },
);
