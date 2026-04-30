/**
 * OAuth Token Refresher
 * Checks all active publishing_channels for tokens expiring within 1 hour.
 * Refreshes them using provider-specific OAuth clients.
 * Marks channels as 'disconnected' if refresh fails.
 */

import { getD1Client } from '@/lib/db/client';
import { encryptToken, decryptToken } from './token-crypto';
import { logger } from '@/lib/utils/logger-utility';
import { refreshAccessToken as refreshTikTok } from '@/lib/tiktok/tiktok-token-manager';
import { refreshAccessToken as refreshYouTube } from '@/lib/youtube/youtube-oauth-client';
import type { PublishingChannel } from './publisher-interface';

const ONE_HOUR_S = 3600;

async function refreshInstagramToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET not configured');
  }

  const res = await fetch(
    `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${refreshToken}`,
  );

  if (!res.ok) throw new Error(`Instagram token refresh failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/**
 * Refresh a single channel's token.
 * Returns the new expiry timestamp (Unix seconds) or throws.
 */
export async function refreshChannelToken(channel: PublishingChannel): Promise<number> {
  if (!channel.access_token) {
    throw new Error(`Channel ${channel.id} has no access_token to refresh`);
  }
  const decrypted = decryptToken(channel.access_token);
  const refreshToken = channel.refresh_token ? decryptToken(channel.refresh_token) : null;

  let newAccessToken: string;
  let expiresIn: number;

  switch (channel.provider) {
    case 'tiktok': {
      if (!refreshToken) throw new Error('TikTok refresh token missing');
      const r = await refreshTikTok(refreshToken);
      newAccessToken = r.access_token;
      expiresIn = r.expires_in;
      break;
    }
    case 'youtube': {
      if (!refreshToken) throw new Error('YouTube refresh token missing');
      const r = await refreshYouTube(refreshToken);
      newAccessToken = r.access_token;
      expiresIn = r.expires_in;
      break;
    }
    case 'instagram': {
      const tokenToRefresh = refreshToken ?? decrypted;
      const r = await refreshInstagramToken(tokenToRefresh);
      newAccessToken = r.access_token;
      expiresIn = r.expires_in;
      break;
    }
    default:
      throw new Error(`Unknown provider: ${channel.provider}`);
  }

  const newExpiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const encrypted = encryptToken(newAccessToken);

  const db = await getD1Client();
  await db
    .from('publishing_channels')
    .update({
      access_token: encrypted,
      expires_at: newExpiresAt,
      updated_at: Math.floor(Date.now() / 1000),
    })
    .eq('id', channel.id);

  return newExpiresAt;
}

/**
 * Scan all active channels and refresh tokens expiring within 1 hour.
 * Called by Inngest cron every 30 minutes.
 */
export async function refreshExpiringTokens(): Promise<{ refreshed: number; failed: number }> {
  const db = await getD1Client();
  const threshold = Math.floor(Date.now() / 1000) + ONE_HOUR_S;

  const { data } = await db
    .from('publishing_channels')
    .select('*')
    .eq('status', 'active')
    .lte('expires_at', threshold);

  const channels = (data ?? []) as unknown as PublishingChannel[];
  let refreshed = 0;
  let failed = 0;

  for (const channel of channels) {
    try {
      await refreshChannelToken(channel);
      refreshed++;
      logger.info('[TokenRefresher] Refreshed token', { channelId: channel.id, provider: channel.provider });
    } catch (err) {
      failed++;
      logger.error('[TokenRefresher] Refresh failed — marking disconnected', err as Error, { channelId: channel.id });
      await db
        .from('publishing_channels')
        .update({ status: 'disconnected', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', channel.id);
    }
  }

  return { refreshed, failed };
}
