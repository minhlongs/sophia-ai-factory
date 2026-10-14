import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { registerYouTubeOAuthClient } from '@/tree/types/oauth-client-types';
import { YOUTUBE_CHANNELS_URL, type YouTubeChannelInfo } from './types';
import { assertOk } from './credentials';
import { uploadVideo } from './video-uploader';
import { refreshAccessToken } from './token-manager';

/** Fetch authenticated user's YouTube channel info */
export async function getChannelInfo(accessToken: string): Promise<YouTubeChannelInfo> {
  if (!shouldAllowRequest('youtube')) {
    throw new Error('Circuit open for youtube — channel info blocked');
  }
  try {
    const res = await fetch(`${YOUTUBE_CHANNELS_URL}?part=snippet&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await assertOk(res, 'YouTube channel info fetch');

    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet: { title: string; thumbnails: { default?: { url: string } } };
      }>;
    };

    const channel = data.items?.[0];
    if (!channel) throw new Error('No YouTube channel found for this account');

    recordSuccess('youtube');
    return {
      channelId: channel.id,
      title: channel.snippet.title,
      thumbnailUrl: channel.snippet.thumbnails.default?.url ?? '',
    };
  } catch (error) {
    recordFailure('youtube', classifyError(error));
    throw error;
  }
}

registerYouTubeOAuthClient({ uploadVideo, refreshAccessToken });
