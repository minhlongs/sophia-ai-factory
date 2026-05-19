/**
 * Handler: social:publish
 *
 * Schedules publishing jobs for SOP-generated videos. Customer-owned channel
 * credentials remain BYOK/self-connected; this handler distributes to channels
 * already connected inside Sophia.
 */

import { createServerClient } from '@/seed/db/client';
import { schedulePublish } from '@/forest/publishing/schedule-publish';
import type { ChannelProvider } from '@/lib/publishing/publisher-interface';
import type { MissionContext, MissionHandlerResult } from './types';

const PROVIDERS: ChannelProvider[] = [
  'tiktok', 'youtube', 'instagram', 'pinterest', 'linkedin', 'zalo',
  'facebook', 'twitter', 'threads', 'reddit', 'bluesky', 'mastodon', 'telegram',
];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeProvider(value: string): ChannelProvider | null {
  const normalized = value === 'x' ? 'twitter' : value === 'youtube_shorts' ? 'youtube' : value;
  return PROVIDERS.includes(normalized as ChannelProvider) ? normalized as ChannelProvider : null;
}

function normalizeCaption(params: Record<string, unknown>): string | undefined {
  const caption = asString(params.caption, asString(params.tweet, asString(params.title)));
  const hashtags = params.hashtags;
  if (!caption && !hashtags) return undefined;
  if (Array.isArray(hashtags)) return `${caption} ${hashtags.map(String).join(' ')}`.trim();
  if (typeof hashtags === 'string') return `${caption} ${hashtags}`.trim();
  return caption || undefined;
}

async function listConnectedChannels(
  db: D1Database,
  userId: string,
  requestedProvider: ChannelProvider | 'all_connected',
): Promise<{ provider: ChannelProvider; channelId: string }[]> {
  const channels: { provider: ChannelProvider; channelId: string }[] = [];
  const oauthProviders = requestedProvider === 'all_connected'
    ? PROVIDERS.filter((p) => p !== 'telegram')
    : requestedProvider === 'telegram'
      ? []
      : [requestedProvider];

  if (oauthProviders.length > 0) {
    const placeholders = oauthProviders.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `SELECT id, provider FROM publishing_channels
         WHERE user_id = ? AND provider IN (${placeholders}) AND status = 'active'
         ORDER BY provider ASC`,
      )
      .bind(userId, ...oauthProviders)
      .all<{ id: string; provider: string }>();

    for (const row of results ?? []) {
      const provider = normalizeProvider(row.provider);
      if (provider) channels.push({ provider, channelId: row.id });
    }
  }

  if (requestedProvider === 'all_connected' || requestedProvider === 'telegram') {
    const tgRow = await db
      .prepare(`SELECT chat_id FROM telegram_paired_chats WHERE paired_by = ? LIMIT 1`)
      .bind(userId)
      .first<{ chat_id: string }>();
    if (tgRow?.chat_id) channels.push({ provider: 'telegram', channelId: tgRow.chat_id });
  }

  return channels;
}

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
