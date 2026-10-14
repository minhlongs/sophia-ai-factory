/**
 * Platform-specific OAuth token refresh functions.
 * Each handles the HTTP exchange for a single provider.
 *
 * @module forest/publishing/oauth-platform-refreshers
 */

import { refreshAccessToken as refreshTikTok } from '@/tree/publishing/tiktok/tiktok-token-manager';
import { refreshAccessToken as refreshYouTube } from '@/land/youtube/youtube-oauth-client';
import { refreshAccessToken as refreshTwitter } from '@/land/video/publishing/providers/twitter-oauth-client';
import { refreshLongLivedToken as refreshThreadsToken } from '@/land/video/publishing/providers/threads';
import { refreshAccessToken as refreshReddit } from '@/land/video/publishing/providers/reddit';
import { refreshAtprotoSession } from '@/land/video/publishing/providers/bluesky';
import type { PublishingChannel } from './publisher-interface';
import {
  refreshInstagramLongLivedToken,
  refreshPinterestToken,
  refreshLinkedInToken,
  refreshZaloToken,
  refreshMastodonToken,
} from './oauth-http-providers';

export {
  refreshInstagramLongLivedToken,
  refreshPinterestToken,
  refreshLinkedInToken,
  refreshZaloToken,
  refreshMastodonToken,
};

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
