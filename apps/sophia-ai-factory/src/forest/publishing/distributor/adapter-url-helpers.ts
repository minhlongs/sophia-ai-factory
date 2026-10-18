/**
 * Platform BYOK Key Resolution, Simulated URL, and X Tweet Dispatch Helpers
 * Layer: Forest
 *
 * @module forest/publishing/distributor/adapter-url-helpers
 */

import type { ViralPlatform } from '@/seed/types/growth';

export function resolveByokKey(
  platform: ViralPlatform,
  byokRecord?: Record<string, string | undefined>,
): string | undefined {
  if (!byokRecord) return undefined;
  switch (platform) {
    case 'tiktok':
      return byokRecord.tiktokApiKey;
    case 'youtube_shorts':
      return byokRecord.youtubeApiKey;
    case 'instagram_reels':
      return byokRecord.instagramApiKey || byokRecord.metaApiKey;
    case 'facebook_reels':
      return byokRecord.facebookApiKey || byokRecord.metaApiKey;
    default:
      return byokRecord.twitterApiKey;
  }
}

export function getSimulatedPostUrl(platform: ViralPlatform, postId: string): string {
  switch (platform) {
    case 'tiktok':
      return `https://www.tiktok.com/@sophia_ai/video/${postId}`;
    case 'youtube_shorts':
      return `https://www.youtube.com/shorts/${postId}`;
    case 'instagram_reels':
      return `https://www.instagram.com/reel/${postId}`;
    case 'facebook_reels':
      return `https://www.facebook.com/reel/${postId}`;
    default:
      return `https://x.com/Sophia_AIFactory/status/${postId}`;
  }
}

export async function dispatchXTweet(
  byokKey: string,
  caption: string,
): Promise<{ postId: string; postUrl: string; status: 'published' }> {
  const tweetRes = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${byokKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: caption }),
  });

  if (!tweetRes.ok) {
    throw new Error(`X tweet dispatch failed: HTTP ${tweetRes.status}`);
  }

  const tweetData = (await tweetRes.json()) as { data: { id: string } };
  const postId = tweetData.data.id;
  return {
    postId,
    status: 'published',
    postUrl: `https://x.com/i/status/${postId}`,
  };
}
