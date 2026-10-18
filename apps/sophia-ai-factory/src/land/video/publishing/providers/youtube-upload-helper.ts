/**
 * YouTube Resumable Upload & Metadata Helpers.
 *
 * @module land/video/publishing/providers/youtube-upload-helper
 */

import type { PublishMeta } from './publisher-interface';

export const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

export function isYouTubeMockMode(): boolean {
  return !process.env.YOUTUBE_CLIENT_ID;
}

export interface YouTubeVideoResource {
  id: string;
  status?: { uploadStatus?: string; privacyStatus?: string };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

export function buildYouTubeMetadata(meta: PublishMeta) {
  const hashtags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  const description = `${adCaption}\n\n${hashtags}${meta.productLink ? `\n\n${meta.productLink}` : ''}`;

  return {
    snippet: {
      title: (meta.title ?? meta.caption).slice(0, 100),
      description: description.slice(0, 5000),
      tags: meta.hashtags.slice(0, 500),
      categoryId: '22',
    },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  };
}

export async function performResumableYouTubeUpload(
  accessToken: string,
  videoUrl: string,
  meta: PublishMeta,
): Promise<string> {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Failed to fetch video: ${videoRes.status}`);
  const videoBlob = await videoRes.blob();
  const contentType = videoRes.headers.get('content-type') ?? 'video/mp4';

  const metadata = buildYouTubeMetadata(meta);

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(videoBlob.size),
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`YouTube upload init failed (${initRes.status}): ${text}`);
  }

  const uploadUri = initRes.headers.get('Location');
  if (!uploadUri) throw new Error('YouTube did not return resumable upload URI');

  const uploadRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(videoBlob.size) },
    body: videoBlob,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`YouTube video upload failed (${uploadRes.status}): ${text}`);
  }

  const result = (await uploadRes.json()) as YouTubeVideoResource;
  return result.id;
}
