/**
 * Facebook Graph API Reels Upload Helper
 * Layer: tree/publishing
 *
 * @module tree/publishing/facebook-reels-uploader
 */

import type { PublishParams, PublishResult } from './platform-adapter';
import { logger } from '@/seed/utils/logger-utility';

export const FB_GRAPH_API = 'https://graph.facebook.com/v19.0';
export const FB_TOKEN_URL = 'https://graph.facebook.com/v19.0/oauth/access_token';

export function parseFacebookAccessToken(accessToken: string): [string, string] {
  return accessToken.includes(':')
    ? (accessToken.split(':', 2) as [string, string])
    : ['me', accessToken];
}

export async function executeFacebookReelsUpload(
  accessToken: string,
  params: PublishParams,
): Promise<PublishResult> {
  const [pageId, pageToken] = parseFacebookAccessToken(accessToken);

  // Step 1: Start upload session
  const startRes = await fetch(`${FB_GRAPH_API}/${pageId}/video_reels`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pageToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      upload_phase: 'start',
      video_file_url: params.videoUrl,
    }),
  });

  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Facebook upload start failed: ${startRes.status} ${err}`);
  }

  const startData = (await startRes.json()) as { video_id?: string; upload_url?: string };
  const videoId = startData.video_id;
  const uploadUrl = startData.upload_url;

  if (!videoId || !uploadUrl) {
    throw new Error('Facebook did not return video_id or upload_url');
  }

  // Step 2: Upload video bytes to the provided URL
  const videoRes = await fetch(params.videoUrl);
  if (!videoRes.ok) throw new Error(`Failed to fetch video from ${params.videoUrl}`);
  const videoBuffer = await videoRes.arrayBuffer();

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pageToken}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBuffer.byteLength),
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Facebook upload failed: ${uploadRes.status} ${err}`);
  }

  // Step 3: Finish upload and publish
  const finishRes = await fetch(`${FB_GRAPH_API}/${pageId}/video_reels`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pageToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      upload_phase: 'finish',
      video_id: videoId,
      title: params.title,
      description: params.description,
    }),
  });

  if (!finishRes.ok) {
    const err = await finishRes.text();
    throw new Error(`Facebook finish upload failed: ${finishRes.status} ${err}`);
  }

  const finishData = (await finishRes.json()) as { id?: string; status?: string };
  const platformVideoId = finishData.id ?? videoId;

  logger.info('[facebook-adapter] Upload complete', {
    platformVideoId,
    status: finishData.status,
  });

  return {
    platformVideoId,
    status: 'processing',
    url: `https://www.facebook.com/${pageId}/videos/${platformVideoId}`,
  };
}
