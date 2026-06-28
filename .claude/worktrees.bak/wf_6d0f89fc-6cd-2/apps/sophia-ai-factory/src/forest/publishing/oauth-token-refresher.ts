/**
 * OAuth Token Refresher
 * Checks all active publishing_channels for tokens expiring within 1 hour.
 *
 * C7: Row-lock via refreshing_at prevents concurrent cron runs from double-rotating.
 * Stale lock threshold: 10 minutes (handles crashed workers).
 *
 * Instagram: uses FB long-lived token re-exchange (no refresh_token — HIGH fix).
 */

import { getD1, createServerClient } from '@/seed/db/client';
import { encryptToken, decryptToken } from './token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { refreshAccessToken as refreshTikTok } from '@/land/tiktok/tiktok-token-manager';
import { refreshAccessToken as refreshYouTube } from '@/land/youtube/youtube-oauth-client';
import { refreshAccessToken as refreshTwitter } from '@/land/video/publishing/providers/twitter-oauth-client';
import { refreshLongLivedToken as refreshThreadsToken } from '@/land/video/publishing/providers/threads';
import { refreshAccessToken as refreshReddit } from '@/land/video/publishing/providers/reddit';
import { refreshAtprotoSession } from '@/land/video/publishing/providers/bluesky';
import { parseExternalAccountId as parseMastodonAccountId } from '@/land/video/publishing/providers/mastodon';
import type { PublishingChannel } from '../land/video/publishing/providers/publisher-interface';

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
  const res = await fetch(
    `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Instagram token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/** Pinterest: standard OAuth2 refresh_token grant */
async function refreshPinterestToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.PINTEREST_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PINTEREST_CLIENT_ID / PINTEREST_CLIENT_SECRET not configured');
  }
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Pinterest token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/** LinkedIn: standard OAuth2 refresh_token grant */
async function refreshLinkedInToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not configured');
  }
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LinkedIn token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/** Zalo OA: standard OAuth2 refresh_token grant */
async function refreshZaloToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const appId = process.env.ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('ZALO_APP_ID / ZALO_APP_SECRET not configured');
  }
  const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      secret_key: appSecret,
    },
    body: new URLSearchParams({
      app_id: appId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Zalo token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: number; message?: string };
  if (data.error && data.error !== 0) {
    throw new Error(`Zalo token refresh error ${data.error}: ${data.message ?? 'unknown'}`);
  }
  return { access_token: data.access_token ?? '', expires_in: data.expires_in ?? 86400 };
}

/**
 * Acquire per-channel row-lock via D1 raw SQL (C7).
 * D1QueryChain has no .or() — must use raw prepare().
 */
async function acquireRefreshLock(channelId: string, now: number): Promise<boolean> {
  const staleBefore = now - LOCK_STALE_S;
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const rawDb = _db;
  const result = await rawDb
    .prepare(
      'UPDATE publishing_channels SET refreshing_at = ? WHERE id = ? AND (refreshing_at IS NULL OR refreshing_at < ?)',
    )
    .bind(now, channelId, staleBefore)
    .run();
  return (result.meta?.changes ?? 0) === 1;
}

/**
 * Refresh Facebook (Page Access Token) — tokens don't expire when derived from long-lived user token.
 * No-op refresh: keep existing token, return synthetic 1-year window.
 */
function buildFacebookRefreshResult(decryptedToken: string): { accessToken: string; expiresIn: number; rotatedRefreshToken: string | null } {
  return { accessToken: decryptedToken, expiresIn: 365 * 24 * 3600, rotatedRefreshToken: null };
}

/**
 * Handle Twitter token refresh with refresh_token rotation.
 */
function buildTwitterRefreshResult(apiResult: { access_token: string; expires_in: number; refresh_token?: string }): { accessToken: string; expiresIn: number; rotatedRefreshToken: string | null } {
  return {
    accessToken: apiResult.access_token,
    expiresIn: apiResult.expires_in,
    rotatedRefreshToken: apiResult.refresh_token ?? null,
  };
}

/**
 * Handle Threads long-lived token re-exchange via th_refresh_token grant (60d TTL).
 */
function buildThreadsRefreshResult(apiResult: { access_token: string; expires_in?: number }): { accessToken: string; expiresIn: number; rotatedRefreshToken: string | null } {
  return { accessToken: apiResult.access_token, expiresIn: apiResult.expires_in ?? 60 * 24 * 3600, rotatedRefreshToken: null };
}

/**
 * Handle Bluesky AT Protocol refresh — uses refreshJwt stored as refresh_token to get new accessJwt.
 * refreshJwt rotates on each refresh — persist new value when different.
 */
function buildBlueskyRefreshResult(apiResult: { accessJwt: string; refreshJwt: string; originalRefreshToken: string }): { accessToken: string; expiresIn: number; rotatedRefreshToken: string | null } {
  const rotated = apiResult.refreshJwt !== apiResult.originalRefreshToken ? apiResult.refreshJwt : null;
  return { accessToken: apiResult.accessJwt, expiresIn: 2 * 3600, rotatedRefreshToken: rotated };
}

/**
 * Refresh Mastodon token via OAuth2 refresh_token grant.
 * Instance URL is encoded in external_account_id as "<instanceUrl>|<accountId>".
 * Returns null for rotated refresh token if not present or credentials not configured.
 */
async function refreshMastodonToken(
  channel: PublishingChannel,
  decryptedToken: string,
  refreshToken: string | null,
): Promise<{ accessToken: string; expiresIn: number; rotatedRefreshToken: string | null }> {
  if (!refreshToken) {
    // No refresh_token — treat as perpetual token (most Mastodon instances)
    return { accessToken: decryptedToken, expiresIn: 365 * 24 * 3600, rotatedRefreshToken: null };
  }

  const { instanceUrl } = parseMastodonAccountId(channel.external_account_id);
  const normalizedInstance = instanceUrl.replace(/\/$/, '');
  const mastodonClientId = process.env.MASTODON_CLIENT_ID;
  const mastodonClientSecret = process.env.MASTODON_CLIENT_SECRET;

  if (!mastodonClientId || !mastodonClientSecret) {
    return { accessToken: decryptedToken, expiresIn: 365 * 24 * 3600, rotatedRefreshToken: null };
  }

  const res = await fetch(`${normalizedInstance}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: mastodonClientId,
      client_secret: mastodonClientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mastodon token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
  if (!data.access_token) throw new Error('Mastodon token refresh returned no access_token');

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 365 * 24 * 3600,
    rotatedRefreshToken: data.refresh_token && data.refresh_token !== refreshToken ? data.refresh_token : null,
  };
}

/**
 * Dispatch token refresh based on provider.
 * Returns the new token, expiry, and optionally a rotated refresh token.
 */
async function dispatchProviderRefresh(
  channel: PublishingChannel,
  decryptedToken: string,
  refreshToken: string | null,
): Promise<{ accessToken: string; expiresIn: number; rotatedRefreshToken: string | null }> {
  switch (channel.provider) {
    case 'tiktok': {
      if (!refreshToken) throw new Error('TikTok refresh token missing');
      const r = await refreshTikTok(refreshToken);
      return { accessToken: r.access_token, expiresIn: r.expires_in, rotatedRefreshToken: null };
    }
    case 'youtube': {
      if (!refreshToken) throw new Error('YouTube refresh token missing');
      const r = await refreshYouTube(refreshToken);
      return { accessToken: r.access_token, expiresIn: r.expires_in, rotatedRefreshToken: null };
    }
    case 'instagram': {
      const r = await refreshInstagramLongLivedToken(decryptedToken);
      return { accessToken: r.access_token, expiresIn: r.expires_in, rotatedRefreshToken: null };
    }
    case 'pinterest': {
      if (!refreshToken) throw new Error('Pinterest refresh token missing');
      const r = await refreshPinterestToken(refreshToken);
      return { accessToken: r.access_token, expiresIn: r.expires_in, rotatedRefreshToken: null };
    }
    case 'linkedin': {
      if (!refreshToken) throw new Error('LinkedIn refresh token missing');
      const r = await refreshLinkedInToken(refreshToken);
      return { accessToken: r.access_token, expiresIn: r.expires_in, rotatedRefreshToken: null };
    }
    case 'zalo': {
      if (!refreshToken) throw new Error('Zalo refresh token missing');
      const r = await refreshZaloToken(refreshToken);
      return { accessToken: r.access_token, expiresIn: r.expires_in, rotatedRefreshToken: null };
    }
    case 'facebook': {
      return buildFacebookRefreshResult(decryptedToken);
    }
    case 'twitter': {
      if (!refreshToken) throw new Error('Twitter refresh token missing');
      const r = await refreshTwitter(refreshToken);
      return buildTwitterRefreshResult(r);
    }
    case 'threads': {
      const r = await refreshThreadsToken(decryptedToken);
      return buildThreadsRefreshResult(r);
    }
    case 'reddit': {
      if (!refreshToken) throw new Error('Reddit refresh token missing');
      const r = await refreshReddit(refreshToken);
      return { accessToken: r.access_token, expiresIn: r.expires_in, rotatedRefreshToken: null };
    }
    case 'bluesky': {
      if (!refreshToken) throw new Error('Bluesky refresh token (refreshJwt) missing');
      const r = await refreshAtprotoSession(refreshToken);
      return buildBlueskyRefreshResult({ ...r, originalRefreshToken: refreshToken });
    }
    case 'mastodon': {
      const result = await refreshMastodonToken(channel, decryptedToken, refreshToken);
      return result;
    }
    default:
      throw new Error(`Unknown provider: ${channel.provider}`);
  }
}

/**
 * Update channel token in database.
 */
async function updateChannelToken(
  channelId: string,
  newAccessToken: string,
  newExpiresAt: number,
  rotatedRefreshToken: string | null,
): Promise<void> {
  const db = createServerClient();
  const updatePatch: Record<string, unknown> = {
    access_token: await encryptToken(newAccessToken),
    expires_at: newExpiresAt,
    updated_at: Math.floor(Date.now() / 1000),
    refreshing_at: null,
  };
  if (rotatedRefreshToken !== null) {
    updatePatch.refresh_token = await encryptToken(rotatedRefreshToken);
  }

  await db
    .from('publishing_channels')
    .update(updatePatch)
    .eq('id', channelId);
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

    const { accessToken, expiresIn, rotatedRefreshToken } = await dispatchProviderRefresh(channel, decrypted, refreshToken);
    const newExpiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    await updateChannelToken(channel.id, accessToken, newExpiresAt, rotatedRefreshToken);

    return newExpiresAt;
  } catch (err) {
    // M1: lock release omitted here — the loop-level catch (refreshExpiringTokens)
    // already sets refreshing_at = null via status='expired' UPDATE, avoiding 2 NULL writes.
    throw err;
  }
}

/**
 * Scan active channels and refresh tokens expiring within 1 hour.
 * Called by Inngest cron every 30 minutes.
 */
export async function refreshExpiringTokens(): Promise<{ refreshed: number; failed: number; skipped: number }> {
  const db = createServerClient();
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
      logger.error('[TokenRefresher] Refresh failed — marking expired', toError(err), { channelId: channel.id });
      await db
        .from('publishing_channels')
        .update({ status: 'expired', updated_at: Math.floor(Date.now() / 1000), refreshing_at: null })
        .eq('id', channel.id);
    }
  }

  return { refreshed, failed, skipped };
}
