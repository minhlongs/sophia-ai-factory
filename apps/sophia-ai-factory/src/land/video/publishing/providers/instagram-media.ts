/**
 * Instagram Graph API media operations
 * @module land/video/publishing/providers/instagram-media
 */

import { logger } from '@/seed/utils/logger-utility';
import { GRAPH_BASE, POLL_ATTEMPTS, POLL_INTERVAL_MS, type IGMediaResponse } from './instagram-helpers';

export async function createMediaContainer(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string,
): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url: videoUrl,
      caption: caption.slice(0, 2200),
      media_type: 'REELS',
      access_token: accessToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram media container creation failed (${res.status}): ${text}`);
  }

  return ((await res.json()) as IGMediaResponse).id;
}

function requestPublish(igUserId: string, accessToken: string, containerId: string): Promise<Response> {
  return fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
}

async function waitForContainer(containerId: string, accessToken: string): Promise<boolean> {
  for (let poll = 0; poll < POLL_ATTEMPTS; poll++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const statusRes = await fetch(
      `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`,
    );
    if (statusRes.ok) {
      const statusData = (await statusRes.json()) as IGMediaResponse;
      if (statusData.status_code === 'FINISHED') return true;
      if (statusData.status_code === 'ERROR') {
        throw new Error('Instagram container processing failed on Meta edge');
      }
    }
  }
  return false;
}

export async function publishContainer(
  igUserId: string,
  accessToken: string,
  containerId: string,
): Promise<string> {
  let publishRes = await requestPublish(igUserId, accessToken, containerId);

  if (!publishRes.ok) {
    const text = await publishRes.text();
    const isProcessing = text.includes('2207027') || text.includes('9007') || text.toLowerCase().includes('not ready');
    if (isProcessing) {
      logger.info('[InstagramPublisher] Container still encoding, polling status before publishing', { containerId });
      if (await waitForContainer(containerId, accessToken)) {
        publishRes = await requestPublish(igUserId, accessToken, containerId);
      }
    }
    if (!publishRes.ok) {
      throw new Error(`Instagram media publish failed (${publishRes.status}): ${text}`);
    }
  }

  return ((await publishRes.json()) as IGMediaResponse).id;
}