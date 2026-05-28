'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  createVideoPublish,
  listVideoPublishes,
  getVideoPublish,
} from '@/seed/db/repositories/video-publishes-repo';
import {
  listPlatformCredentials,
  deletePlatformCredential,
} from '@/seed/db/repositories/platform-credentials-repo';
import {
  getDecryptedCredentials,
  storeCredentials,
  getClientCredentials,
} from '@/lib/publishing/credential-manager';
import { getAdapter } from '@/lib/publishing/token-refresh-service';
import { inngest } from '@/forest/inngest/client';
import type { Platform } from '@/lib/publishing/platform-adapter';
import type { VideoPublish } from '@/seed/db/repositories/video-publishes-repo';

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function publishVideoAction(input: {
  videoId: string;
  videoUrl: string;
  platform: Platform;
  title: string;
  description: string;
  tags?: string[];
  privacy?: 'public' | 'unlisted' | 'private';
  scheduledAt?: string;
}): Promise<ActionResult<{ publishId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const creds = await getDecryptedCredentials(user.id, input.platform);
  if (!creds) return { success: false, error: `${input.platform} not connected` };

  try {
    const publish = await createVideoPublish({
      userId: user.id,
      videoId: input.videoId,
      platform: input.platform,
      metadata: JSON.stringify({
        title: input.title,
        description: input.description,
        tags: input.tags,
        privacy: input.privacy,
      }),
      scheduledAt: input.scheduledAt,
    });

    // If scheduled for later, don't upload now
    if (input.scheduledAt && new Date(input.scheduledAt) > new Date()) {
      return { success: true, data: { publishId: publish.id } };
    }

    const adapter = getAdapter(input.platform);

    // Auto-refresh if expired
    let accessToken = creds.accessToken;
    if (creds.isExpired && creds.refreshToken) {
      const clientCreds = await getClientCredentials(user.id, input.platform);
      if (clientCreds) {
        const refreshed = await adapter.refreshToken(
          clientCreds.clientId,
          clientCreds.clientSecret,
          creds.refreshToken,
        );
        accessToken = refreshed.accessToken;
        await storeCredentials({
          userId: user.id,
          platform: input.platform,
          accessToken: refreshed.accessToken,
          expiresIn: refreshed.expiresIn,
        });
      }
    }

    const result = await adapter.uploadVideo(accessToken, {
      videoUrl: input.videoUrl,
      title: input.title,
      description: input.description,
      tags: input.tags,
      privacy: input.privacy,
      scheduledAt: input.scheduledAt,
    });

    const { updateVideoPublishStatus } = await import(
      '@/seed/db/repositories/video-publishes-repo'
    );
    await updateVideoPublishStatus(publish.id, result.status, {
      platformVideoId: result.platformVideoId,
    });

    // Auto-create performance feedback cycle if video corresponds to a Campaign or SOP Execution
    try {
      const { getD1Raw } = await import('@/seed/db/client');
      const { logger } = await import('@/seed/utils/logger-utility');
      const db = await getD1Raw();
      const sopExec = await db.prepare(
        `SELECT id, user_id, sop_template_id FROM sop_executions WHERE id = ?1 LIMIT 1`
      ).bind(input.videoId).first<{ id: string; user_id: string; sop_template_id: string }>();

      let executionId: string | null = null;
      let sopId: string | null = null;
      let userId: string | null = null;

      if (sopExec) {
        executionId = sopExec.id;
        sopId = sopExec.sop_template_id;
        userId = sopExec.user_id;
      } else {
        const campaign = await db.prepare(
          `SELECT id, user_id, template_id FROM campaigns WHERE id = ?1 LIMIT 1`
        ).bind(input.videoId).first<{ id: string; user_id: string; template_id: string }>();

        if (campaign) {
          executionId = campaign.id;
          sopId = campaign.template_id;
          userId = campaign.user_id;
        }
      }

      if (executionId && sopId && userId) {
        const { createFeedbackCycle } = await import('@/tree/sop/performance-feedback-engine');
        await createFeedbackCycle({
          executionId,
          sopId,
          userId,
          publishedAt: Math.floor(Date.now() / 1000),
        });
      }
    } catch (e) {
      const { logger } = await import('@/seed/utils/logger-utility');
      logger.error('publishVideoAction.createFeedbackCycle_failed', {
        videoId: input.videoId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return { success: true, data: { publishId: publish.id } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function getPublishHistoryAction(
  videoId?: string,
): Promise<ActionResult<VideoPublish[]>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const publishes = await listVideoPublishes(user.id, videoId);
  return { success: true, data: publishes };
}

export async function getConnectedPlatformsAction(): Promise<
  ActionResult<Array<{ platform: string; channelName: string | null }>>
> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const creds = await listPlatformCredentials(user.id);
  return {
    success: true,
    data: creds.map((c) => ({
      platform: c.platform,
      channelName: c.platform_channel_name,
    })),
  };
}

export async function disconnectPlatformAction(
  platform: Platform,
): Promise<ActionResult<{ disconnected: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  await deletePlatformCredential(user.id, platform);
  return { success: true, data: { disconnected: true } };
}
