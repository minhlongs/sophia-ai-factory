/**
 * Server Actions for Social Direct Publishing
 * Provides user-authenticated endpoints for publishing dispatch,
 * channel credentials, and emergency kill-switch toggles.
 * Layer: land (Server Actions) | Max LOC: < 200 | Zero :any
 * @module land/social/actions/social-publisher-actions
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import type { SocialPlatform, SocialPublishResult } from '@/seed/types/social-publisher-types';
import { encryptTokenVault } from '@/seed/security/oauth-token-vault';
import {
  getCredential,
  upsertCredential,
  listUserCredentials,
  setChannelKillSwitch,
} from '@/land/social/platform-credentials-store';
import { createPublishJob, toSocialPublishResult } from '@/land/social/publish-job-store';
import { toError } from '@/seed/utils/to-error';

export const dispatchSocialPublishSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']),
  videoUrl: z.string().url('Must be a valid video URL'),
  title: z.string().min(1, 'Title is required').max(150),
  description: z.string().max(2000).optional().default(''),
  tags: z.array(z.string()).optional(),
  totalSizeBytes: z.number().positive().optional(),
  scheduledFor: z.number().positive().optional(),
});

export const updateChannelCredentialsSchema = z.object({
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']),
  channelId: z.string().min(1, 'Channel ID is required'),
  channelName: z.string().min(1, 'Channel name is required'),
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.number().positive('Expiration timestamp must be positive'),
});

export type DispatchSocialPublishInput = z.input<typeof dispatchSocialPublishSchema>;
export type UpdateChannelCredentialsInput = z.input<typeof updateChannelCredentialsSchema>;

export interface SocialPublisherActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export async function dispatchSocialPublishAction(
  rawInput: DispatchSocialPublishInput,
): Promise<SocialPublisherActionResponse<SocialPublishResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized: login required', code: 'UNAUTHORIZED' };

    const parsed = dispatchSocialPublishSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' };
    }

    const cred = await getCredential(user.id, parsed.data.platform, parsed.data.channelId);
    if (!cred) return { success: false, error: 'Channel credentials not configured', code: 'NOT_FOUND' };
    if (cred.killSwitchActive) {
      return { success: false, error: 'Channel emergency kill switch active', code: 'KILL_SWITCH_ACTIVE' };
    }

    const job = await createPublishJob({
      userId: user.id,
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
        userId: user.id,
        channelId: parsed.data.channelId,
        platform: parsed.data.platform,
        videoUrl: parsed.data.videoUrl,
        title: parsed.data.title,
        description: parsed.data.description ?? '',
        tags: parsed.data.tags ?? [],
      },
    });

    return { success: true, data: toSocialPublishResult(job) };
  } catch (err: unknown) {
    return { success: false, error: toError(err).message, code: 'INTERNAL_ERROR' };
  }
}

export async function listConnectedChannelsAction(): Promise<SocialPublisherActionResponse<Array<{
  id: string; platform: SocialPlatform; channelId: string; channelName: string;
  dailyPostCount: number; tokenExpiresAt: number; lastPublishedAt?: number;
  killSwitchActive: boolean; updatedAt: number;
}>>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

    const creds = await listUserCredentials(user.id);
    const sanitized = creds.map((c) => ({
      id: c.id,
      platform: c.platform,
      channelId: c.channelId,
      channelName: c.channelName,
      dailyPostCount: c.dailyPostCount,
      tokenExpiresAt: c.tokenExpiresAt,
      lastPublishedAt: c.lastPublishedAt,
      killSwitchActive: c.killSwitchActive,
      updatedAt: c.updatedAt,
    }));
    return { success: true, data: sanitized };
  } catch (err: unknown) {
    return { success: false, error: toError(err).message, code: 'INTERNAL_ERROR' };
  }
}

export async function toggleChannelKillSwitchAction(
  channelId: string,
  isKilled: boolean,
): Promise<SocialPublisherActionResponse<{ channelId: string; killSwitchActive: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    if (!channelId) return { success: false, error: 'Channel ID required', code: 'VALIDATION_ERROR' };

    const updated = await setChannelKillSwitch(user.id, channelId, isKilled);
    if (!updated) return { success: false, error: 'Channel not found', code: 'NOT_FOUND' };

    return { success: true, data: { channelId, killSwitchActive: isKilled } };
  } catch (err: unknown) {
    return { success: false, error: toError(err).message, code: 'INTERNAL_ERROR' };
  }
}

export async function triggerEmergencyKillSwitchAction(channelId: string) {
  return toggleChannelKillSwitchAction(channelId, true);
}

export async function updateChannelCredentialsAction(
  rawInput: UpdateChannelCredentialsInput,
): Promise<SocialPublisherActionResponse<{ channelId: string; platform: SocialPlatform }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

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
      { userId: user.id, platform: parsed.data.platform, channelId: parsed.data.channelId },
    );

    const record = await upsertCredential({
      userId: user.id,
      platform: parsed.data.platform,
      channelId: parsed.data.channelId,
      channelName: parsed.data.channelName,
      encryptedTokens,
      tokenExpiresAt: parsed.data.tokenExpiresAt,
    });

    return { success: true, data: { channelId: record.channelId, platform: record.platform } };
  } catch (err: unknown) {
    return { success: false, error: toError(err).message, code: 'INTERNAL_ERROR' };
  }
}
