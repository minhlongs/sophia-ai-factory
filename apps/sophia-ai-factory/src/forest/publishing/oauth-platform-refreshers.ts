/**
 * Platform-specific OAuth token refresh functions.
 * Each handles the HTTP exchange for a single provider.
 *
 * @module forest/publishing/oauth-platform-refreshers
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import { refreshAccessToken as refreshTikTok } from '@/land/tiktok/tiktok-token-manager';
import { refreshAccessToken as refreshYouTube } from '@/land/youtube/youtube-oauth-client';
import { refreshAccessToken as refreshTwitter } from '@/land/video/publishing/providers/twitter-oauth-client';
import { refreshLongLivedToken as refreshThreadsToken } from '@/land/video/publishing/providers/threads';
import { refreshAccessToken as refreshReddit } from '@/land/video/publishing/providers/reddit';
import { refreshAtprotoSession } from '@/land/video/publishing/providers/bluesky';
import { parseExternalAccountId as parseMastodonAccountId } from '@/land/video/publishing/providers/mastodon';
import type { PublishingChannel } from './publisher-interface';

const SERVICE_NAME = 'oauth-token-refresher' as const;

// ── Instagram ──────────────────────────────────────────────────────────────

export async function refreshInstagramLongLivedToken(
  currentToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  if (!shouldAllowRequest(SERVICE_NAME)) throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) throw new Error('INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET not configured');
  try {
    const res = await fetch(`https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`);
    if (!res.ok) { const body = await res.text().catch(() => ''); logger.warn('Failed to read oauth token refresh response', { error: String(res.status), context: 'refresh*' }); recordFailure(SERVICE_NAME, classifyHttpStatus(res.status)); throw new Error(`Instagram token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`); }
    recordSuccess(SERVICE_NAME);
    return res.json() as Promise<{ access_token: string; expires_in: number }>;
  } catch (error) { if (error instanceof Error && error.message.includes('Circuit breaker')) throw error; recordFailure(SERVICE_NAME, classifyError(error)); throw error; }
}

// ── Pinterest ──────────────────────────────────────────────────────────────

export async function refreshPinterestToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  if (!shouldAllowRequest(SERVICE_NAME)) throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  const clientId = process.env.PINTEREST_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('PINTEREST_CLIENT_ID / PINTEREST_CLIENT_SECRET not configured');
  try {
    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!res.ok) { const body = await res.text().catch(() => ''); logger.warn('Failed to read oauth token refresh response', { error: String(res.status), context: 'refresh*' }); recordFailure(SERVICE_NAME, classifyHttpStatus(res.status)); throw new Error(`Pinterest token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`); }
    recordSuccess(SERVICE_NAME);
    return res.json() as Promise<{ access_token: string; expires_in: number }>;
  } catch (error) { if (error instanceof Error && error.message.includes('Circuit breaker')) throw error; recordFailure(SERVICE_NAME, classifyError(error)); throw error; }
}

// ── LinkedIn ───────────────────────────────────────────────────────────────

export async function refreshLinkedInToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  if (!shouldAllowRequest(SERVICE_NAME)) throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not configured');
  try {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
    });
    if (!res.ok) { const body = await res.text().catch(() => ''); logger.warn('Failed to read oauth token refresh response', { error: String(res.status), context: 'refresh*' }); recordFailure(SERVICE_NAME, classifyHttpStatus(res.status)); throw new Error(`LinkedIn token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`); }
    recordSuccess(SERVICE_NAME);
    return res.json() as Promise<{ access_token: string; expires_in: number }>;
  } catch (error) { if (error instanceof Error && error.message.includes('Circuit breaker')) throw error; recordFailure(SERVICE_NAME, classifyError(error)); throw error; }
}

// ── Zalo ───────────────────────────────────────────────────────────────────

export async function refreshZaloToken(_refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  if (!shouldAllowRequest(SERVICE_NAME)) throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  const appId = process.env.ZALO_APP_ID;
  const secretKey = process.env.ZALO_APP_SECRET;
  if (!appId || !secretKey) throw new Error('ZALO_APP_ID / ZALO_APP_SECRET not configured');
  try {
    const res = await fetch('https://graph.zalo.me/v2.0/oauth/refresh_token', {
      method: 'GET',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) { const body = await res.text().catch(() => ''); logger.warn('Failed to read oauth token refresh response', { error: String(res.status), context: 'refresh*' }); recordFailure(SERVICE_NAME, classifyHttpStatus(res.status)); throw new Error(`Zalo token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`); }
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: number; message?: string };
    if (data.error && data.error !== 0) throw new Error(`Zalo token refresh error ${data.error}: ${data.message ?? 'unknown'}`);
    recordSuccess(SERVICE_NAME);
    return data as { access_token: string; expires_in: number };
  } catch (error) { if (error instanceof Error && error.message.includes('Circuit breaker')) throw error; recordFailure(SERVICE_NAME, classifyError(error)); throw error; }
}

// ── Mastodon ───────────────────────────────────────────────────────────────

export async function refreshMastodonToken(
  channel: PublishingChannel, decryptedToken: string, refreshToken: string | null,
): Promise<{ accessToken: string; expiresIn: number; rotatedRefreshToken: string | null }> {
  if (!refreshToken) return { accessToken: decryptedToken, expiresIn: 365 * 24 * 3600, rotatedRefreshToken: null };
  const { instanceUrl } = parseMastodonAccountId(channel.external_account_id);
  const normalizedInstance = instanceUrl.replace(/\/$/, '');
  const mastodonClientId = process.env.MASTODON_CLIENT_ID;
  const mastodonClientSecret = process.env.MASTODON_CLIENT_SECRET;
  if (!mastodonClientId || !mastodonClientSecret) throw new Error('MASTODON_CLIENT_ID / MASTODON_CLIENT_SECRET not configured');
  if (!shouldAllowRequest(SERVICE_NAME)) throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  try {
    const res = await fetch(`${normalizedInstance}/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: mastodonClientId, client_secret: mastodonClientSecret, redirect_uri: 'urn:ietf:wg:oauth:2.0:oob' }),
    });
    if (!res.ok) { const body = await res.text().catch(() => ''); logger.warn('Failed to read oauth token refresh response', { error: String(res.status), context: 'refresh*' }); recordFailure(SERVICE_NAME, classifyHttpStatus(res.status)); throw new Error(`Mastodon token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`); }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('Mastodon token refresh returned no access_token');
    recordSuccess(SERVICE_NAME);
    return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600, rotatedRefreshToken: null };
  } catch (error) { if (error instanceof Error && error.message.includes('Circuit breaker')) throw error; recordFailure(SERVICE_NAME, classifyError(error)); throw error; }
}

// ── Result builders ────────────────────────────────────────────────────────

type RefreshResult = { accessToken: string; expiresIn: number; rotatedRefreshToken: string | null };

export function buildFacebookRefreshResult(decryptedToken: string): RefreshResult {
  return { accessToken: decryptedToken, expiresIn: 365 * 24 * 3600, rotatedRefreshToken: null };
}
export function buildTwitterRefreshResult(apiResult: { access_token: string; expires_in: number; refresh_token?: string }): RefreshResult {
  return { accessToken: apiResult.access_token, expiresIn: apiResult.expires_in, rotatedRefreshToken: apiResult.refresh_token ?? null };
}
export function buildThreadsRefreshResult(apiResult: { access_token: string; expires_in?: number }): RefreshResult {
  return { accessToken: apiResult.access_token, expiresIn: apiResult.expires_in ?? 3600, rotatedRefreshToken: null };
}
export function buildBlueskyRefreshResult(apiResult: { accessJwt: string; refreshJwt: string; originalRefreshToken: string }): RefreshResult {
  const rotated = apiResult.refreshJwt !== apiResult.originalRefreshToken ? apiResult.refreshJwt : null;
  return { accessToken: apiResult.accessJwt, expiresIn: 2 * 3600, rotatedRefreshToken: rotated };
}

// ── Dispatch ───────────────────────────────────────────────────────────────

/**
 * Dispatch token refresh based on provider.
 * Returns the new token, expiry, and optionally a rotated refresh token.
 */
export async function dispatchProviderRefresh(
  channel: PublishingChannel,
  decryptedToken: string,
  refreshToken: string | null,
): Promise<RefreshResult> {
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
    case 'twitter': {
      if (!refreshToken) throw new Error('Twitter refresh token missing');
      const r = await refreshTwitter(refreshToken);
      return buildTwitterRefreshResult(r);
    }
    case 'reddit': {
      if (!refreshToken) throw new Error('Reddit refresh token missing');
      const r = await refreshReddit(refreshToken);
      return { accessToken: r.access_token, expiresIn: r.expires_in, rotatedRefreshToken: r.refresh_token ?? null };
    }
    case 'bluesky': {
      if (!refreshToken) throw new Error('Bluesky refresh token (refreshJwt) missing');
      const r = await refreshAtprotoSession(refreshToken);
      return buildBlueskyRefreshResult({ ...r, originalRefreshToken: refreshToken });
    }
    case 'facebook': return buildFacebookRefreshResult(decryptedToken);
    case 'mastodon': return refreshMastodonToken(channel, decryptedToken, refreshToken);
    case 'threads': {
      const r = await refreshThreadsToken(decryptedToken);
      return buildThreadsRefreshResult(r);
    }
    default: throw new Error(`Unknown provider: ${channel.provider}`);
  }
}
