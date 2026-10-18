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
import {
  resolveByokKey,
  getSimulatedPostUrl,
  dispatchXTweet,
} from './adapter-url-helpers';

export interface DispatchUploadResult {
  postId: string;
  postUrl: string | undefined;
  status: 'published' | 'scheduled' | 'simulated';
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
  const fallbackPostId = `post_${platform}_${input.videoId}_${Date.now()}`;

  if (!byokKey || !input.videoUrl) {
    return {
      postId: fallbackPostId,
      postUrl: getSimulatedPostUrl(platform, fallbackPostId),
      status: input.scheduledAt ? 'scheduled' : 'published',
    };
  }

  switch (platform) {
    case 'tiktok': {
      const res = await tiktokAdapter.uploadVideo(byokKey, {
        videoUrl: input.videoUrl,
        title: caption.slice(0, 150),
        description: caption,
        privacy: 'public',
      });
      const postId = res.platformVideoId;
      return {
        postId,
        status: 'published',
        postUrl: res.url || `https://www.tiktok.com/@creator/video/${postId}`,
      };
    }
    case 'youtube_shorts': {
      const res = await youtubeAdapter.uploadVideo(byokKey, {
        videoUrl: input.videoUrl,
        title: `${input.videoTitle} #Shorts`.slice(0, 100),
        description: caption,
        privacy: 'public',
        tags: ['Shorts', input.niche],
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : undefined,
      });
      const postId = res.platformVideoId;
      return {
        postId,
        status: input.scheduledAt ? 'scheduled' : 'published',
        postUrl: res.url || `https://www.youtube.com/shorts/${postId}`,
      };
    }
    case 'instagram_reels': {
      const res = await instagramAdapter.uploadVideo(byokKey, {
        videoUrl: input.videoUrl,
        title: input.videoTitle.slice(0, 150),
        description: caption,
        privacy: 'public',
        tags: ['Reels', input.niche],
      });
      const postId = res.platformVideoId;
      return {
        postId,
        status: 'published',
        postUrl: res.url || `https://www.instagram.com/reel/${postId}`,
      };
    }
    case 'facebook_reels': {
      const res = await facebookAdapter.uploadVideo(byokKey, {
        videoUrl: input.videoUrl,
        title: input.videoTitle.slice(0, 150),
        description: caption,
        privacy: 'public',
        tags: ['FBReels', input.niche],
      });
      const postId = res.platformVideoId;
      return {
        postId,
        status: 'published',
        postUrl: res.url || `https://www.facebook.com/reel/${postId}`,
      };
    }
    case 'twitter':
    case 'x':
      return dispatchXTweet(byokKey, caption);
    default:
      return {
        postId: fallbackPostId,
        postUrl: undefined,
        status: 'simulated',
      };
  }
}
