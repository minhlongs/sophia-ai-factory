/**
 * OAuth Token Refresher
 * Checks all active publishing_channels for tokens expiring within 1 hour.
 *
 * C7: Row-lock via refreshing_at prevents concurrent cron runs from double-rotating.
 * Stale lock threshold: 10 minutes (handles crashed workers).
 *
 * Instagram: uses FB long-lived token re-exchange (no refresh_token — HIGH fix).
 */

import { createServerClient } from '@/seed/db/client';
import { decryptToken } from './token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { PublishingChannel } from './publisher-interface';
import { acquireRefreshLock, updateChannelToken } from './oauth-refresh-storage';
import { dispatchProviderRefresh } from './oauth-platform-refreshers';

const ONE_HOUR_S = 3600;

/**
 * Refresh a single channel's token with row-lock.
 * Returns the new expiry timestamp (Unix seconds) or throws.
 */
export async function refreshChannelToken(channel: PublishingChannel): Promise<number> {
  if (!channel.access_token) {
    throw new Error(`Channel ${channel.id} has no access_token to refresh`);
  }

  const now = Math.floor(Date.now() / 1000);
  const locked = await acquireRefreshLock(channel.id, now);
  if (!locked) {
    throw new Error(`Refresh lock held by another worker for channel ${channel.id}`);
  }

  try {
    const decryptedToken = await decryptToken(channel.access_token);
    const refreshToken = channel.refresh_token ? await decryptToken(channel.refresh_token) : null;

    const result = await dispatchProviderRefresh(channel, decryptedToken, refreshToken);
    const newExpiresAt = now + result.expiresIn;

    await updateChannelToken(channel.id, result.accessToken, newExpiresAt, result.rotatedRefreshToken);

    return newExpiresAt;
  } catch (err) {
    // Release lock on failure
    const db = createServerClient();
    await db
      .from('publishing_channels')
      .update({ refreshing_at: null })
      .eq('id', channel.id);
    throw err;
  }
}

/**
 * Refresh all channels whose tokens expire within 1 hour.
 * Returns counts for refreshed / failed / skipped.
 */
export async function refreshExpiringTokens(): Promise<{ refreshed: number; failed: number; skipped: number }> {
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);
  const threshold = now + ONE_HOUR_S;

  const { data: channels } = await db
    .from('publishing_channels')
    .select('*')
    .eq('status', 'active')
    .lte('expires_at', threshold);

  if (!channels || channels.length === 0) {
    return { refreshed: 0, failed: 0, skipped: 0 };
  }

  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const channel of channels) {
    try {
      await refreshChannelToken(channel as unknown as PublishingChannel);
      refreshed++;
      logger.info('[TokenRefresher] Refreshed token', { channelId: channel.id, provider: channel.provider });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('lock held by another worker')) {
        skipped++;
        continue;
      }
      failed++;
      logger.error('[TokenRefresher] Refresh failed — marking expired', toError(err), { channelId: channel.id });
      await db
        .from('publishing_channels')
        .update({ status: 'expired', updated_at: Math.floor(Date.now() / 1000), refreshing_at: null })
        .eq('id', channel.id);
    }
  }

  return { refreshed, failed, skipped };
}
