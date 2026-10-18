/**
 * Autonomous Video Pipeline Social Distribution Helper
 *
 * Layer: forest/inngest/functions (Reusable Infrastructure Orchestrator)
 * @module forest/inngest/functions/autonomous-video-pipeline-distribution
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import type { PipelineExecutionSummary, PipelineNiche } from '@/forest/video/video-pipeline-types';
import { toSocialPlatform, type SocialPlatform } from '@/seed/types/social-publisher-types';
import { listUserCredentials } from '@/land/social/platform-credentials-store';
import { createPublishJob } from '@/land/social/publish-job-store';

export interface PipelineDistributionInput {
  campaignId: string;
  userId?: string;
  autoPublish?: boolean;
  videoUrl?: string;
  niche: PipelineNiche;
  targetPlatforms?: ('youtube_shorts' | 'tiktok' | 'instagram_reels')[];
}

export async function dispatchSocialDistributionForPipeline(
  data: PipelineDistributionInput,
  summary: PipelineExecutionSummary,
): Promise<
  | { jobsCreated: number; reason: string }
  | { jobsCreated: number; jobs: Array<{ jobId: string; platform: SocialPlatform; status: string }> }
> {
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
}
