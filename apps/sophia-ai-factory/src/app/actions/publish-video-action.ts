'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getErrorMessage } from '@/seed/utils/to-error';
import { publishVideo } from '@/land/video/publishing/video-publishing.service';

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Server Action: publishVideoAction
 *
 * Wraps video-service.publishVideo() with ActionResult format.
 */

export async function publishVideoAction(input: {
  videoId: string;
  videoUrl: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  title: string;
  description: string;
  tags?: string[];
  privacy?: 'public' | 'unlisted' | 'private';
  scheduledAt?: string;
}): Promise<ActionResult<{ publishId: string }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const result = await publishVideo(
      {
        videoId: input.videoId,
        videoUrl: input.videoUrl,
        platform: input.platform,
        title: input.title,
        description: input.description,
        tags: input.tags,
        privacy: input.privacy,
        scheduledAt: input.scheduledAt,
      },
      user.id,
    );

    if (result.success) {
      return { success: true, data: { publishId: result.publishId } };
    } else {
      return { success: false, error: result.error };
    }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function getPublishHistoryAction(
  videoId?: string,
): Promise<ActionResult<Array<unknown>>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { listVideoPublishes } = await import('@/seed/db/repositories/video-publishes-repo');
  const publishes = await listVideoPublishes(user.id, videoId);
  return { success: true, data: publishes };
}

export async function getConnectedPlatformsAction() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { listPlatformCredentials } = await import('@/seed/db/repositories/platform-credentials-repo');
  const creds = await listPlatformCredentials(user.id);
  return {
    success: true,
    data: creds.map((c) => ({
      platform: c.platform,
      channelName: c.platform_channel_name,
    })),
  };
}

export async function disconnectPlatformAction(platform: 'youtube' | 'tiktok' | 'telegram') {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { deletePlatformCredential } = await import('@/seed/db/repositories/platform-credentials-repo');
  await deletePlatformCredential(user.id, platform);
  return { success: true, data: { disconnected: true } };
}
