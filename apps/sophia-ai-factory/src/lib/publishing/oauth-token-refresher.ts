/**
 * OAuth Token Refresher
 * Checks all active publishing_channels for tokens expiring within 1 hour.
 *
 * C7: Row-lock via refreshing_at prevents concurrent cron runs from double-rotating.
 * Stale lock threshold: 10 minutes (handles crashed workers).
 *
 * Instagram: uses FB long-lived token re-exchange (no refresh_token — HIGH fix).
 */

import { getD1Client, getD1Raw } from '@/lib/db/client';
import { encryptToken, decryptToken } from './token-crypto';
import { logger } from '@/lib/utils/logger-utility';
import { refreshAccessToken as refreshTikTok } from '@/lib/tiktok/tiktok-token-manager';
import { refreshAccessToken as refreshYouTube } from '@/lib/youtube/youtube-oauth-client';
import type { PublishingChannel } from './publisher-interface';

const ONE_HOUR_S = 3600;
const LOCK_STALE_S = 600; // 10 minutes

/**
 * Instagram: re-exchange current long-lived token for a fresh one (60 days).
 * FB uses fb_exchange_token grant — no separate refresh_token concept.
 */
async function refreshInstagramLongLivedToken(
  currentToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET not configured');
  }
  // C-NEW-1: use POST with body — GET leaks client_secret + token into Cloudflare access logs
  const res = await fetch('https://graph.facebook.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: currentToken,
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Strip any reflected secrets from error body before logging
    const sanitizedBody = body
      .replace(/client_secret=[^&\s"']*/g, 'client_secret=[REDACTED]')
      .replace(/fb_exchange_token=[^&\s"']*/g, 'fb_exchange_token=[REDACTED]')
      .slice(0, 200);
    throw new Error(`Instagram token refresh failed: HTTP ${res.status} — ${sanitizedBody}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/**
 * Acquire per-channel row-lock via D1 raw SQL (C7).
 * D1QueryChain has no .or() — must use raw prepare().
 */
async function acquireRefreshLock(channelId: string, now: number): Promise<boolean> {
  const staleBefore = now - LOCK_STALE_S;
  const rawDb = await getD1Raw();
  const result = await rawDb
    .prepare(
      'UPDATE publishing_channels SET refreshing_at = ? WHERE id = ? AND (refreshing_at IS NULL OR refreshing_at < ?)',
    )
    .bind(now, channelId, staleBefore)
    .run();
  return (result.meta?.changes ?? 0) === 1;
}

async function releaseRefreshLock(channelId: string): Promise<void> {
  const rawDb = await getD1Raw();
  await rawDb
    .prepare('UPDATE publishing_channels SET refreshing_at = NULL WHERE id = ?')
    .bind(channelId)
    .run();
}

/**
 * Refresh a single channel's token with row-lock.
 * Returns the new expiry timestamp (Unix seconds) or throws.
 */
export async function refreshChannelToken(channel: PublishingChannel): Promise<number> {
  if (!channel.access_token) {
    throw new Error(`Channel ${channel.id} has no access_token to refresh`);
  }

  const now = Math.floor(Date.now() / 1000);

  // Acquire row-lock (C7)
  const locked = await acquireRefreshLock(channel.id, now);
  if (!locked) {
    logger.info('[TokenRefresher] Refresh lock held by another worker, skipping', { channelId: channel.id });
    throw new Error(`Refresh lock held by another worker for channel ${channel.id}`);
  }

  try {
    const decrypted = await decryptToken(channel.access_token);
    const refreshToken = channel.refresh_token ? await decryptToken(channel.refresh_token) : null;

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
        // FB long-lived token re-exchange — no refresh_token concept
        const r = await refreshInstagramLongLivedToken(decrypted);
        newAccessToken = r.access_token;
        expiresIn = r.expires_in;
        break;
      }
      default:
        throw new Error(`Unknown provider: ${channel.provider}`);
    }

    const newExpiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const encrypted = await encryptToken(newAccessToken);

    const db = await getD1Client();
    await db
      .from('publishing_channels')
      .update({
        access_token: encrypted,
        expires_at: newExpiresAt,
        updated_at: Math.floor(Date.now() / 1000),
        refreshing_at: null, // release lock on success
      })
      .eq('id', channel.id);

    return newExpiresAt;
  } catch (err) {
    await releaseRefreshLock(channel.id).catch(() => undefined);
    throw err;
  }
}

/**
 * Scan active channels and refresh tokens expiring within 1 hour.
 * Called by Inngest cron every 30 minutes.
 */
export async function refreshExpiringTokens(): Promise<{ refreshed: number; failed: number; skipped: number }> {
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
  let skipped = 0;

  for (const channel of channels) {
    try {
      await refreshChannelToken(channel);
      refreshed++;
      logger.info('[TokenRefresher] Refreshed token', { channelId: channel.id, provider: channel.provider });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('lock held by another worker')) {
        skipped++;
        continue;
      }
      failed++;
      logger.error('[TokenRefresher] Refresh failed — marking expired', err as Error, { channelId: channel.id });
      await db
        .from('publishing_channels')
        .update({ status: 'expired', updated_at: Math.floor(Date.now() / 1000), refreshing_at: null })
        .eq('id', channel.id);
    }
  }

  return { refreshed, failed, skipped };
}
