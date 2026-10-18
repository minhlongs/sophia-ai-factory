/**
 * Handler: youtube:publish
 *
 * Uploads a video to a SPECIFIC YouTube channel selected by the user.
 * Multi-account aware (P13): caller MUST pass `channel_id` (the
 * publishing_channels.id, NOT the YouTube external_account_id).
 */

import { createServerClient } from '@/seed/db/client';
import { YouTubePublisher } from '@/land/video/publishing/providers/youtube-publisher';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingChannel } from '@/forest/publishing/publisher-interface';
import type { MissionHandlerResult, MissionContext } from '@/forest/missions/types';
import { resolveYoutubeAccessToken, sanitizeYoutubeError } from './youtube-publish-helper';

type ChannelRow = PublishingChannel;

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;
  const videoUrl = (params?.video_url as string) ?? '';
  const channelId = (params?.channel_id as string) ?? '';
  const title = (params?.title as string) ?? 'My Video';
  const description = (params?.description as string) ?? '';
  const hashtagsRaw = params?.hashtags;
  const hashtags: string[] = Array.isArray(hashtagsRaw)
    ? hashtagsRaw.filter((h): h is string => typeof h === 'string')
    : [];

  if (!videoUrl) return { ok: false, error: 'missing_video_url' };
  if (!channelId) {
    return {
      ok: false,
      error: 'missing_channel_id',
      data: { hint: 'Call youtube:list-channels first to obtain available channel.id values' },
    };
  }

  const db = createServerClient();
  const { data: channel } = await db
    .from('publishing_channels')
    .select('id, external_account_id, display_name, status, access_token, expires_at, refresh_token, provider, tenant_id, user_id, created_at, updated_at')
    .eq('id', channelId)
    .eq('tenant_id', userId)
    .eq('provider', 'youtube')
    .single() as { data: ChannelRow | null; error: unknown };

  if (!channel) return { ok: false, error: 'channel_not_found' };
  if (channel.status !== 'active') {
    return { ok: false, error: 'channel_disconnected', data: { status: channel.status } };
  }

  const tokenResult = await resolveYoutubeAccessToken(db, channel);
  if (!tokenResult.ok) return tokenResult.result;

  const publisher = new YouTubePublisher(tokenResult.accessToken);
  try {
    const externalPostId = await publisher.upload(videoUrl, {
      caption: description || title,
      hashtags,
      title,
    });
    return {
      ok: true,
      data: {
        external_post_id: externalPostId,
        watch_url: externalPostId.startsWith('mock_')
          ? null
          : `https://www.youtube.com/watch?v=${externalPostId}`,
        channel_id: channel.external_account_id,
        channel_title: channel.display_name,
        title,
      },
    };
  } catch (err) {
    logger.error(
      '[youtube:publish] Upload failed',
      err instanceof Error ? err : new Error(String(err)),
      { channelId: channel.id },
    );
    return {
      ok: false,
      error: 'youtube_upload_failed',
      data: { message: sanitizeYoutubeError(err) },
    };
  }
}
