/**
 * Internal execution helpers for Social Direct Publishing Server Actions.
 * Layer: land | Zero :any
 * @module land/social/actions/social-publisher-helpers
 */

import { inngest } from '@/seed/inngest/client';
import type { SocialPlatform, SocialPublishResult } from '@/seed/types/social-publisher-types';
import { encryptTokenVault } from '@/seed/security/oauth-token-vault';
import {
  getCredential,
  upsertCredential,
} from '@/land/social/platform-credentials-store';
import { createPublishJob, toSocialPublishResult } from '@/land/social/publish-job-store';
import {
  dispatchSocialPublishSchema,
  updateChannelCredentialsSchema,
  type DispatchSocialPublishInput,
  type UpdateChannelCredentialsInput,
  type SocialPublisherActionResponse,
} from './social-publisher-schemas';

export async function executeDispatchSocialPublish(
  userId: string,
  rawInput: DispatchSocialPublishInput,
): Promise<SocialPublisherActionResponse<SocialPublishResult>> {
  const parsed = dispatchSocialPublishSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' };
  }

  const cred = await getCredential(userId, parsed.data.platform, parsed.data.channelId);
  if (!cred) return { success: false, error: 'Channel credentials not configured', code: 'NOT_FOUND' };
  if (cred.killSwitchActive) {
    return { success: false, error: 'Channel emergency kill switch active', code: 'KILL_SWITCH_ACTIVE' };
  }

  const job = await createPublishJob({
    userId,
    channelId: parsed.data.channelId,
    platform: parsed.data.platform,
    videoUrl: parsed.data.videoUrl,
    title: parsed.data.title,
    description: parsed.data.description ?? '',
    tags: parsed.data.tags,
    scheduledFor: parsed.data.scheduledFor,
  });

  await inngest.send({
    name: 'social.publish.dispatched',
    data: {
      jobId: job.id,
      userId,
      channelId: parsed.data.channelId,
      platform: parsed.data.platform,
      videoUrl: parsed.data.videoUrl,
      title: parsed.data.title,
      description: parsed.data.description ?? '',
      tags: parsed.data.tags ?? [],
    },
  });

  return { success: true, data: toSocialPublishResult(job) };
}

export async function executeUpdateChannelCredentials(
  userId: string,
  rawInput: UpdateChannelCredentialsInput,
): Promise<SocialPublisherActionResponse<{ channelId: string; platform: SocialPlatform }>> {
  const parsed = updateChannelCredentialsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' };
  }

  const encryptedTokens = await encryptTokenVault(
    {
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
      expiresAt: parsed.data.tokenExpiresAt,
    },
    { userId, platform: parsed.data.platform, channelId: parsed.data.channelId },
  );

  const record = await upsertCredential({
    userId,
    platform: parsed.data.platform,
    channelId: parsed.data.channelId,
    channelName: parsed.data.channelName,
    encryptedTokens,
    tokenExpiresAt: parsed.data.tokenExpiresAt,
  });

  return { success: true, data: { channelId: record.channelId, platform: record.platform } };
}
