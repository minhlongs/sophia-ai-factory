/**
 * Helpers for youtube:publish mission handler
 * Layer: forest/youtube/missions
 */

import type { D1Client } from '@/seed/db/client';
import { decryptToken } from '@/tree/crypto/token-crypto';
import { refreshChannelToken } from '@/forest/publishing/oauth-token-refresher';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingChannel } from '@/forest/publishing/publisher-interface';
import type { MissionHandlerResult } from '@/forest/missions/types';

const REFRESH_LEAD_SECONDS = 3600;

export function sanitizeYoutubeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [REDACTED]')
    .replace(/access_token=[^&\s"']*/g, 'access_token=[REDACTED]')
    .replace(/refresh_token=[^&\s"']*/g, 'refresh_token=[REDACTED]')
    .slice(0, 500);
}

export async function resolveYoutubeAccessToken(
  db: D1Client,
  channel: PublishingChannel,
): Promise<{ ok: true; accessToken: string } | { ok: false; result: MissionHandlerResult }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (channel.expires_at && channel.expires_at < nowSeconds + REFRESH_LEAD_SECONDS) {
    try {
      await refreshChannelToken(channel);
      const { data: refreshed } = (await db
        .from('publishing_channels')
        .select('access_token')
        .eq('id', channel.id)
        .single()) as { data: { access_token: string } | null; error: unknown };
      if (refreshed) channel.access_token = refreshed.access_token;
    } catch (refreshErr) {
      logger.warn('[youtube:publish] Token refresh failed', {
        channelId: channel.id,
        err: sanitizeYoutubeError(refreshErr),
      });
      return {
        ok: false,
        result: {
          ok: false,
          error: 'token_refresh_failed',
          data: { hint: 'Reconnect YouTube in Settings > Integrations' },
        },
      };
    }
  }

  if (!channel.access_token) {
    return {
      ok: false,
      result: {
        ok: false,
        error: 'channel_disconnected',
        data: { hint: 'Channel has no stored access_token; reconnect via Settings > Integrations' },
      },
    };
  }

  try {
    const accessToken = await decryptToken(channel.access_token);
    return { ok: true, accessToken };
  } catch (err) {
    logger.error(
      '[youtube:publish] Token decryption failed',
      err instanceof Error ? err : new Error(String(err)),
      { channelId: channel.id },
    );
    return { ok: false, result: { ok: false, error: 'token_decrypt_failed' } };
  }
}
