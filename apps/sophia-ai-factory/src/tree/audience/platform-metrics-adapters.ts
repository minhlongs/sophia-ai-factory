/**
 * Platform-specific HTTP adapters for audience metrics fetching.
 *
 * Layer: tree/audience
 *
 * @module tree/audience/platform-metrics-adapters
 */

import { recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind';
import type { AudiencePlatform, PlatformMetricsSnapshot } from './types';

const YT_API = 'https://youtube.googleapis.com/youtube/v3';
const FB_GRAPH_API = 'https://graph.facebook.com/v19.0';
const TIKTOK_API = 'https://open.tiktokapis.com/v2';
const IG_GRAPH_API = 'https://graph.facebook.com/v19.0';

export async function fetchByPlatform(
  platform: AudiencePlatform,
  accessToken: string,
): Promise<PlatformMetricsSnapshot> {
  switch (platform) {
    case 'youtube':
      return fetchYouTubeMetrics(accessToken);
    case 'facebook':
      return fetchFacebookMetrics(accessToken);
    case 'tiktok':
      return fetchTikTokMetrics(accessToken);
    case 'instagram':
      return fetchInstagramMetrics(accessToken);
  }
}

async function fetchJson(
  url: string,
  init: RequestInit,
  platform: AudiencePlatform,
): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      recordFailure(`audience-${platform}`, FailureKind.AUTH_FAILURE);
    } else {
      recordFailure(`audience-${platform}`, classifyHttpStatus(res.status));
    }
    throw new Error(`${platform} API ${res.status}`);
  }
  return res.json();
}

async function fetchYouTubeMetrics(accessToken: string): Promise<PlatformMetricsSnapshot> {
  const channel = (await fetchJson(
    `${YT_API}/channels?part=statistics&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    'youtube',
  )) as { items?: Array<{ statistics?: { subscriberCount?: string } }> };

  const subscribers = Number(channel.items?.[0]?.statistics?.subscriberCount ?? 0);
  return { platform: 'youtube', followers: subscribers, engagementRate: 0, demographics: {} };
}

async function fetchFacebookMetrics(accessToken: string): Promise<PlatformMetricsSnapshot> {
  const [pageId, pageToken] = accessToken.includes(':')
    ? accessToken.split(':', 2)
    : ['me', accessToken];

  const page = (await fetchJson(
    `${FB_GRAPH_API}/${pageId}?fields=fan_count,followers_count,talking_about_count&access_token=${pageToken}`,
    {},
    'facebook',
  )) as { fan_count?: number; followers_count?: number; talking_about_count?: number };

  const followers = page.followers_count ?? page.fan_count ?? 0;
  const engagementRate = followers > 0 ? (page.talking_about_count ?? 0) / followers : 0;
  return { platform: 'facebook', followers, engagementRate, demographics: {} };
}

async function fetchTikTokMetrics(accessToken: string): Promise<PlatformMetricsSnapshot> {
  const data = (await fetchJson(
    `${TIKTOK_API}/user/info/?fields=follower_count,likes_count,video_count`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    'tiktok',
  )) as { data?: { user?: { follower_count?: number; likes_count?: number; video_count?: number } } };

  const user = data.data?.user;
  const followers = user?.follower_count ?? 0;
  const videos = user?.video_count ?? 0;
  const avgLikesPerVideo = videos > 0 ? (user?.likes_count ?? 0) / videos : 0;
  const engagementRate = followers > 0 ? Math.min(1, avgLikesPerVideo / followers) : 0;
  return { platform: 'tiktok', followers, engagementRate, demographics: {} };
}

async function fetchInstagramMetrics(accessToken: string): Promise<PlatformMetricsSnapshot> {
  const me = (await fetchJson(
    `${IG_GRAPH_API}/me?fields=id&access_token=${accessToken}`,
    {},
    'instagram',
  )) as { id?: string };
  if (!me.id) throw new Error('Instagram did not return a user id');

  const profile = (await fetchJson(
    `${IG_GRAPH_API}/${me.id}?fields=followers_count&access_token=${accessToken}`,
    {},
    'instagram',
  )) as { followers_count?: number };

  return { platform: 'instagram', followers: profile.followers_count ?? 0, engagementRate: 0, demographics: {} };
}
