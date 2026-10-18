/**
 * Social Direct Publisher Action Helpers
 *
 * Layer: app/actions | Zero :any.
 */

import { inngest } from '@/seed/inngest/client';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import { createPublishJob, type StoredPublishJob } from '@/land/social/publish-job-store';
import { listUserCredentials } from '@/land/social/platform-credentials-store';
import { evaluateChannelPacing } from '@/tree/social/publisher/pacing-engine';

export interface PublishDispatchInput {
  title: string;
  caption: string;
  videoUrl: string;
  platforms: SocialPlatform[];
  useJitter: boolean;
}

export interface PublishActionResult {
  ok: boolean;
  message: string;
  jobIds?: string[];
}

export async function sendSocialPublishDispatchedEvent(
  job: Pick<
    StoredPublishJob,
    'id' | 'channelId' | 'platform' | 'videoUrl' | 'title' | 'description'
  >,
  userId: string,
): Promise<void> {
  await inngest.send({
    name: 'social.publish.dispatched',
    data: {
      jobId: job.id,
      userId,
      channelId: job.channelId,
      platform: job.platform,
      videoUrl: job.videoUrl,
      title: job.title,
      description: job.description,
    },
  });
}

export async function dispatchToSelectedPlatforms(
  userId: string,
  input: PublishDispatchInput,
): Promise<{ createdJobIds: string[]; errors: string[] }> {
  const credentials = await listUserCredentials(userId);
  const createdJobIds: string[] = [];
  const errors: string[] = [];

  for (const platform of input.platforms) {
    const cred = credentials.find((c) => c.platform === platform);
    if (!cred) {
      errors.push(`${platform}: Kênh chưa liên kết / Channel not connected`);
      continue;
    }
    if (cred.killSwitchActive) {
      errors.push(`${platform}: Kênh đang bật Kill Switch bảo vệ / Kill switch is active`);
      continue;
    }

    const jitterOffsetMs = input.useJitter
      ? evaluateChannelPacing({
          platform,
          channelId: cred.channelId,
          todayPublishedCount: cred.dailyPostCount,
          lastPublishedAtMs: cred.lastPublishedAt ?? null,
        }).delayMs
      : 0;

    const scheduledFor = jitterOffsetMs > 0 ? Date.now() + jitterOffsetMs : undefined;

    try {
      const job = await createPublishJob({
        userId,
        channelId: cred.channelId,
        platform,
        videoUrl: input.videoUrl,
        title: input.title,
        description: input.caption,
        status: 'PENDING',
        scheduledFor,
      });

      createdJobIds.push(job.id);
      await sendSocialPublishDispatchedEvent(job, userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${platform}: ${msg}`);
    }
  }

  return { createdJobIds, errors };
}
