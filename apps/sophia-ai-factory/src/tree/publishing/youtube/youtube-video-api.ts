/**
 * YouTube Data API v3 Video Upload & Channel Info helpers.
 */

import { logger } from '@/seed/utils/logger-utility';

const YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';

export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  thumbnailUrl: string;
}

export interface UploadVideoParams {
  accessToken: string;
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
}

export async function assertYouTubeOk(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    const text = await res.text();
    logger.error(`${label} failed`, new Error(text), { status: res.status });
    throw new Error(`${label} failed: ${res.status}`);
  }
}

/** Upload a video via resumable upload and return the YouTube watch URL */
export async function uploadVideo(params: UploadVideoParams): Promise<string> {
  const { accessToken, videoUrl, title, description, tags } = params;

  const videoRes = await fetch(videoUrl);
  await assertYouTubeOk(videoRes, 'Video source fetch');
  const videoBlob = await videoRes.blob();
  const contentType = videoRes.headers.get('content-type') ?? 'video/mp4';

  const metadata = {
    snippet: { title, description, tags, categoryId: '22' },
    status: { privacyStatus: 'public' },
  };

  const initRes = await fetch(`${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': String(videoBlob.size),
    },
    body: JSON.stringify(metadata),
  });
  await assertYouTubeOk(initRes, 'YouTube upload initiation');

  const uploadUri = initRes.headers.get('Location');
  if (!uploadUri) throw new Error('YouTube did not return a resumable upload URI');

  const uploadRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(videoBlob.size) },
    body: videoBlob,
  });
  await assertYouTubeOk(uploadRes, 'YouTube video upload');

  const result = (await uploadRes.json()) as { id: string };
  return `https://www.youtube.com/watch?v=${result.id}`;
}

/** Fetch authenticated user's YouTube channel info */
export async function getChannelInfo(accessToken: string): Promise<YouTubeChannelInfo> {
  const res = await fetch(`${YOUTUBE_CHANNELS_URL}?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await assertYouTubeOk(res, 'YouTube channel info fetch');

  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      snippet: { title: string; thumbnails: { default?: { url: string } } };
    }>;
  };

  const channel = data.items?.[0];
  if (!channel) throw new Error('No YouTube channel found for this account');

  return {
    channelId: channel.id,
    title: channel.snippet.title,
    thumbnailUrl: channel.snippet.thumbnails.default?.url ?? '',
  };
}
