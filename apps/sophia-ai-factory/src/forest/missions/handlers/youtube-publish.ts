/**
 * Handler: youtube:publish
 *
 * Uploads a video to a SPECIFIC YouTube channel selected by the user.
 * Multi-account aware (P13): caller MUST pass `channel_id` (the
 * publishing_channels.id, NOT the YouTube external_account_id).
 *
 * Flow:
 *   1. Validate params.video_url + params.channel_id.
 *   2. Lookup publishing_channels row by id + tenant_id + provider='youtube'.
 *   3. Auto-refresh access_token when expiring within 1 hour (parity with publish-execute).
 *   4. Decrypt access_token; delegate upload to YouTubePublisher.
 *   5. Return external YouTube video ID + watch URL.
 *
 * Error codes:
 *   - `missing_video_url` — params.video_url absent.
 *   - `missing_channel_id` — caller should call youtube:list-channels first.
 *   - `channel_not_found` — channel_id does not match a row owned by the caller
 *     (also covers provider mismatch and tenant isolation).
 *   - `channel_disconnected` — row found but status !== 'active'.
 *   - `token_refresh_failed` — refresh attempt threw; caller should reconnect.
 *   - `token_decrypt_failed` — AES decryption threw (corrupt ciphertext).
 *   - `youtube_upload_failed` — YouTubePublisher.upload threw.
 */

import { createServerClient } from '@/seed/db/client';
import { decryptToken } from '@/lib/publishing/token-crypto';
import { refreshChannelToken } from '@/lib/publishing/oauth-token-refresher';
import { YouTubePublisher } from '@/lib/publishing/youtube-publisher';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingChannel } from '@/lib/publishing/publisher-interface';
import type { MissionHandlerResult, MissionContext } from './types';

const REFRESH_LEAD_SECONDS = 3600;

type ChannelRow = PublishingChannel;

function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [REDACTED]')
    .replace(/access_token=[^&\s"']*/g, 'access_token=[REDACTED]')
    .replace(/refresh_token=[^&\s"']*/g, 'refresh_token=[REDACTED]')
    .slice(0, 500);
}

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

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (channel.expires_at && channel.expires_at < nowSeconds + REFRESH_LEAD_SECONDS) {
    try {
      await refreshChannelToken(channel);
      const { data: refreshed } = await db
        .from('publishing_channels')
        .select('access_token')
        .eq('id', channel.id)
        .single() as { data: { access_token: string } | null; error: unknown };
      if (refreshed) channel.access_token = refreshed.access_token;
    } catch (refreshErr) {
      logger.warn('[youtube:publish] Token refresh failed', {
        channelId: channel.id,
        err: sanitizeError(refreshErr),
      });
      return {
        ok: false,
        error: 'token_refresh_failed',
        data: { hint: 'Reconnect YouTube in Settings > Integrations' },
      };
    }
  }

  if (!channel.access_token) {
    return {
      ok: false,
      error: 'channel_disconnected',
      data: { hint: 'Channel has no stored access_token; reconnect via Settings > Integrations' },
    };
  }

  let accessToken: string;
  try {
    accessToken = await decryptToken(channel.access_token);
  } catch (err) {
    logger.error(
      '[youtube:publish] Token decryption failed',
      err instanceof Error ? err : new Error(String(err)),
      { channelId: channel.id },
    );
    return { ok: false, error: 'token_decrypt_failed' };
  }

  const publisher = new YouTubePublisher(accessToken);
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
      data: { message: sanitizeError(err) },
    };
  }
}
