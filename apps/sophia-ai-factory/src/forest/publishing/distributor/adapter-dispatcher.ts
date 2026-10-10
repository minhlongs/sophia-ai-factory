/**
 * Platform Adapter Dispatcher and URL Simulation
 * Layer: Forest
 *
 * @module forest/publishing/distributor/adapter-dispatcher
 */

import type { ViralPlatform, ViralPublishInput } from '@/seed/types/growth';
import { tiktokAdapter } from '../tiktok-adapter';
import { youtubeAdapter } from '../youtube-adapter';
import { instagramAdapter } from '../instagram-adapter';
import { facebookAdapter } from '@/tree/publishing/facebook-adapter';

export interface DispatchUploadResult {
  postId: string;
  postUrl: string | undefined;
  status: 'published' | 'scheduled' | 'simulated';
}

function resolveByokKey(platform: ViralPlatform, byokRecord?: Record<string, string | undefined>): string | undefined {
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

function getSimulatedPostUrl(platform: ViralPlatform, postId: string): string {
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

/**
 * Dispatch upload to live platform adapter or simulate post URL.
 */
export async function dispatchPlatformUpload(
  platform: ViralPlatform,
  input: ViralPublishInput,
  caption: string,
): Promise<DispatchUploadResult> {
  const byokRecord = input.byokKeys as Record<string, string | undefined> | undefined;
  const byokKey = resolveByokKey(platform, byokRecord);

  let postId = `post_${platform}_${input.videoId}_${Date.now()}`;
  let postUrl: string | undefined = undefined;
  let status: 'published' | 'scheduled' | 'simulated' = 'simulated';

  if (byokKey && input.videoUrl) {
    if (platform === 'tiktok') {
      const res = await tiktokAdapter.uploadVideo(byokKey, {
        videoUrl: input.videoUrl,
        title: caption.slice(0, 150),
        description: caption,
        privacy: 'public',
      });
      postId = res.platformVideoId;
      status = 'published';
      postUrl = res.url || `https://www.tiktok.com/@creator/video/${postId}`;
    } else if (platform === 'youtube_shorts') {
      const res = await youtubeAdapter.uploadVideo(byokKey, {
        videoUrl: input.videoUrl,
        title: `${input.videoTitle} #Shorts`.slice(0, 100),
        description: caption,
        privacy: 'public',
        tags: ['Shorts', input.niche],
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : undefined,
      });
      postId = res.platformVideoId;
      status = input.scheduledAt ? 'scheduled' : 'published';
      postUrl = res.url || `https://www.youtube.com/shorts/${postId}`;
    } else if (platform === 'instagram_reels') {
      const res = await instagramAdapter.uploadVideo(byokKey, {
        videoUrl: input.videoUrl,
        title: input.videoTitle.slice(0, 150),
        description: caption,
        privacy: 'public',
        tags: ['Reels', input.niche],
      });
      postId = res.platformVideoId;
      status = 'published';
      postUrl = res.url || `https://www.instagram.com/reel/${postId}`;
    } else if (platform === 'facebook_reels') {
      const res = await facebookAdapter.uploadVideo(byokKey, {
        videoUrl: input.videoUrl,
        title: input.videoTitle.slice(0, 150),
        description: caption,
        privacy: 'public',
        tags: ['FBReels', input.niche],
      });
      postId = res.platformVideoId;
      status = 'published';
      postUrl = res.url || `https://www.facebook.com/reel/${postId}`;
    } else if (platform === 'twitter' || platform === 'x') {
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
      postId = tweetData.data.id;
      status = 'published';
      postUrl = `https://x.com/i/status/${postId}`;
    }
  } else {
    postUrl = getSimulatedPostUrl(platform, postId);
    status = input.scheduledAt ? 'scheduled' : 'published';
  }

  return { postId, postUrl, status };
}
