/**
 * Instagram Graph API helpers: container creation, publish-with-encoding-poll,
 * status and insights fetches. Used by InstagramPublisher.
 */

import type { PublishMeta } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

const GRAPH_API_VERSION = 'v19.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export function isMockMode(): boolean {
  return !process.env.INSTAGRAM_APP_ID;
}

export interface IGMediaResponse {
  id: string;
  status_code?: string;
}

export interface IGInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: number }> }>;
}

const POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 2000;

export function buildCaption(meta: PublishMeta): string {
  const hashtags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  return `${adCaption}\n\n${hashtags}${meta.productLink ? `\n\n${meta.productLink}` : ''}`;
}

/** Step 1: create a REELS media container and return its id. */
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

/** Polls the container until Meta finishes encoding; true when FINISHED. */
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

/** Step 2: publish the container, polling once if Meta reports it is still encoding. */
export async function publishContainer(
  igUserId: string,
  accessToken: string,
  containerId: string,
): Promise<string> {
  let publishRes = await requestPublish(igUserId, accessToken, containerId);

  if (!publishRes.ok) {
    const text = await publishRes.text();
    // Meta Graph API error 9007 / 2207027: "The media is not ready for publishing, please wait for a moment"
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

/** Returns the media status_code, or null when the request is not OK. */
export async function fetchMediaStatusCode(
  mediaId: string,
  accessToken: string,
): Promise<string | undefined | null> {
  const res = await fetch(`${GRAPH_BASE}/${mediaId}?fields=status_code&access_token=${accessToken}`);
  if (!res.ok) return null;
  return ((await res.json()) as IGMediaResponse).status_code;
}

/** Returns the insights payload, or null when the request is not OK. */
export async function fetchMediaInsights(
  mediaId: string,
  accessToken: string,
): Promise<IGInsightsResponse | null> {
  const res = await fetch(
    `${GRAPH_BASE}/${mediaId}/insights?metric=impressions,reach,likes,comments,shares&access_token=${accessToken}`,
  );
  if (!res.ok) return null;
  return (await res.json()) as IGInsightsResponse;
}
