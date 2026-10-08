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
import { toSocialPlatform, type SocialPlatform } from '@/seed/types/social-publisher-types';
import { listUserCredentials } from '@/land/social/platform-credentials-store';
import { createPublishJob } from '@/land/social/publish-job-store';

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
    if (!data.userId) {
      return { jobsCreated: 0, reason: 'NO_USER_ID' };
    }

    const requestedPlatforms = (data.targetPlatforms ?? ['youtube_shorts', 'tiktok', 'instagram_reels'])
      .map(toSocialPlatform);

    const userCreds = await listUserCredentials(data.userId);
    const eligibleCreds = userCreds.filter(
      (c) => !c.killSwitchActive && requestedPlatforms.includes(c.platform),
    );

    if (eligibleCreds.length === 0) {
      logger.warn('autonomousVideoPipelineJob: no active credentials for distribution', {
        userId: data.userId,
        requestedPlatforms,
      });
      return { jobsCreated: 0, reason: 'NO_ACTIVE_CHANNELS' };
    }

    const videoUrl = data.videoUrl ?? `https://storage.sophia.agencyos.network/videos/${data.campaignId}/final.mp4`;
    const initialStatus = data.autoPublish === true ? 'PENDING' : 'DRAFT';
    const createdJobs: Array<{ jobId: string; platform: SocialPlatform; status: string }> = [];

    for (const cred of eligibleCreds) {
      const title = summary.manifest.title;
      const description = summary.manifest.scriptText ?? '';
      const tags = [summary.manifest.niche, 'ai', 'video'];

      const job = await createPublishJob({
        userId: data.userId,
        channelId: cred.channelId,
        platform: cred.platform,
        videoUrl,
        title,
        description,
        tags,
        status: initialStatus,
      });

      if (data.autoPublish === true) {
        await inngest.send({
          name: 'social.publish.dispatched',
          data: {
            jobId: job.id,
            userId: data.userId,
            channelId: cred.channelId,
            platform: cred.platform,
            videoUrl,
            title,
            description,
            tags,
          },
        });
      }

      createdJobs.push({ jobId: job.id, platform: cred.platform, status: job.status });
    }

    return { jobsCreated: createdJobs.length, jobs: createdJobs };
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
