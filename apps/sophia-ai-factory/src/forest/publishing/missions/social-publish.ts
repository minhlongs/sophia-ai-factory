/**
 * Handler: social:publish
 *
 * Schedules publishing jobs for SOP-generated videos. Customer-owned channel
 * credentials remain BYOK/self-connected; this handler distributes to channels
 * already connected inside Sophia.
 */

import { createServerClient } from '@/seed/db/client';
import { schedulePublish } from '@/forest/publishing/schedule-publish';
import type { MissionContext, MissionHandlerResult } from '@/forest/missions/types';
import {
  asString,
  normalizeProvider,
  normalizeCaption,
  listConnectedChannels,
} from './social-publish-helpers';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;
  const rawPlatform = asString(params.platform, 'all_connected');
  const provider = rawPlatform === 'all_connected' ? 'all_connected' : normalizeProvider(rawPlatform);
  if (!provider) return { ok: false, error: `Unsupported publish platform: ${rawPlatform}` };

  const videoId = asString(params.video_id, asString(params.videoId));
  if (!videoId) {
    return {
      ok: true,
      data: {
        publishedChannels: [],
        publishedPlatforms: [],
        jobIds: [],
        skipped: true,
        reason: 'No internal Sophia video_id was provided; external video_url publishing is not scheduled automatically.',
      },
    };
  }

  const db = createServerClient().unwrap();
  const channels = await listConnectedChannels(db, userId, provider);

  if (channels.length === 0) {
    const specific = provider !== 'all_connected';
    return specific
      ? { ok: false, error: `No connected ${provider} channel found` }
      : {
          ok: true,
          data: {
            videoId,
            video_id: videoId,
            publishedChannels: [],
            publishedPlatforms: [],
            jobIds: [],
            skipped: true,
            reason: 'No connected channels yet',
          },
        };
  }

  const schedule = asString(params.schedule, 'now');
  const scheduledAt = typeof params.scheduled_at === 'number'
    ? params.scheduled_at
    : typeof params.scheduledAt === 'number'
      ? params.scheduledAt
      : Math.floor(Date.now() / 1000);
  const caption = normalizeCaption(params);
  const jobIds: string[] = [];

  for (const channel of channels) {
    const result = await schedulePublish(db, {
      channelId: channel.channelId,
      videoId,
      tenantId: userId,
      userId,
      caption,
      scheduledAt: schedule === 'now' ? Math.floor(Date.now() / 1000) : scheduledAt,
      provider: channel.provider,
    });
    jobIds.push(result.jobId);
  }

  const publishedPlatforms = channels.map((channel) => channel.provider);
  return {
    ok: true,
    data: {
      videoId,
      video_id: videoId,
      publishedChannels: publishedPlatforms,
      publishedPlatforms,
      jobIds,
      scheduledAt,
    },
  };
}
