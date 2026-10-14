/**
 * HTTP client routines for Zalo OA API v3.
 * @module land/video/publishing/providers/zalo/api-client
 */

import {
  ZALO_OA_API,
  type ZaloUploadResponse,
  type ZaloBroadcastResponse,
} from './types';

/**
 * Downloads video binary and uploads to Zalo OA media endpoint.
 */
export async function uploadVideoFile(accessToken: string, videoUrl: string): Promise<string> {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(`[ZaloPublisher] Failed to fetch video: ${videoRes.status}`);
  }
  const videoBlob = await videoRes.blob();
  const contentType = videoRes.headers.get('content-type') ?? 'video/mp4';

  const formData = new FormData();
  formData.append('file', videoBlob, 'video.mp4');
  formData.append('type', contentType);

  const uploadRes = await fetch(`${ZALO_OA_API}/v3/oa/message/video/upload`, {
    method: 'POST',
    headers: { access_token: accessToken },
    body: formData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`[ZaloPublisher] Video upload failed (${uploadRes.status}): ${text}`);
  }

  const uploadData = (await uploadRes.json()) as ZaloUploadResponse;
  if (uploadData.error !== 0) {
    throw new Error(`[ZaloPublisher] Upload error ${uploadData.error}: ${uploadData.message}`);
  }

  const videoId = uploadData.data?.video_id;
  if (!videoId) {
    throw new Error('[ZaloPublisher] No video_id returned from upload');
  }

  return videoId;
}

/**
 * Broadcasts an uploaded video to Zalo OA timeline followers.
 */
export async function broadcastVideoMessage(
  accessToken: string,
  videoId: string,
  caption: string,
): Promise<string> {
  const broadcastRes = await fetch(`${ZALO_OA_API}/v3/oa/message/broadcast`, {
    method: 'POST',
    headers: {
      access_token: accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { user_id: 'all' },
      message: {
        attachment: {
          type: 'video',
          payload: {
            video_id: videoId,
            description: caption,
          },
        },
      },
    }),
  });

  if (!broadcastRes.ok) {
    const text = await broadcastRes.text();
    throw new Error(`[ZaloPublisher] Broadcast failed (${broadcastRes.status}): ${text}`);
  }

  const broadcastData = (await broadcastRes.json()) as ZaloBroadcastResponse;
  if (broadcastData.error !== 0) {
    throw new Error(`[ZaloPublisher] Broadcast error ${broadcastData.error}: ${broadcastData.message}`);
  }

  return broadcastData.data?.broadcast_id ?? videoId;
}

/**
 * Retrieves delivery and read statistics for a broadcast post.
 */
export async function fetchBroadcastStatistics(
  accessToken: string,
  externalPostId: string,
): Promise<{ views: number; likes: number; reach: number } | null> {
  const res = await fetch(
    `${ZALO_OA_API}/v3/oa/statistic/message?broadcast_id=${encodeURIComponent(externalPostId)}`,
    { headers: { access_token: accessToken } },
  );

  if (!res.ok) return null;

  const data = (await res.json()) as {
    error: number;
    data?: { sent?: number; delivered?: number; read?: number };
  };

  if (data.error !== 0) return null;

  return {
    views: data.data?.read ?? 0,
    likes: 0,
    reach: data.data?.delivered ?? 0,
  };
}
