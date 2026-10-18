import type { PlatformAdapter, PublishParams, PublishResult, PublishStatus } from './platform-adapter';
import { uploadYoutubeVideo } from './youtube-upload-helper';

const YT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const YT_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const youtubeAdapter: PlatformAdapter = {
  platform: 'youtube',

  async uploadVideo(accessToken: string, params: PublishParams): Promise<PublishResult> {
    return uploadYoutubeVideo(accessToken, params);
  },

  async checkStatus(
    accessToken: string,
    platformVideoId: string,
  ): Promise<{ status: PublishStatus; error?: string }> {
    const res = await fetch(
      `${YT_VIDEOS_URL}?id=${platformVideoId}&part=status,processingDetails`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!res.ok) {
      return { status: 'failed', error: `YouTube API ${res.status}` };
    }

    const data = await res.json() as {
      items?: Array<{
        status?: { uploadStatus?: string; privacyStatus?: string; publishAt?: string };
        processingDetails?: { processingStatus?: string };
      }>;
    };

    const item = data.items?.[0];
    if (!item) return { status: 'failed', error: 'Video not found on YouTube' };

    const uploadStatus = item.status?.uploadStatus;
    const processingStatus = item.processingDetails?.processingStatus;

    if (uploadStatus === 'rejected' || uploadStatus === 'failed') {
      return { status: 'failed', error: `Upload ${uploadStatus}` };
    }

    if (processingStatus === 'succeeded' || uploadStatus === 'processed') {
      return { status: 'published' };
    }

    return { status: 'processing' };
  },

  async refreshToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const res = await fetch(YT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`YouTube token refresh failed: ${res.status} ${err}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  },
};
