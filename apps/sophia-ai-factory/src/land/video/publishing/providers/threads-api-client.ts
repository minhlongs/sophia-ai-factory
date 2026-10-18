/**
 * Threads Graph API media container creation, publishing, and insights parser.
 * @module land/video/publishing/providers/threads-api-client
 */

import type { MetricsJson, PublishMeta } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import {
  THREADS_BASE,
  buildThreadsCaption,
  type ThreadsCreateResponse,
  type ThreadsInsightsResponse,
} from './threads-helpers';

export async function createAndPublishThreadsContainer(
  userId: string,
  accessToken: string,
  videoUrl: string,
  meta: PublishMeta,
): Promise<string> {
  const text = buildThreadsCaption(meta);

  const containerRes = await fetch(`${THREADS_BASE}/${userId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'VIDEO',
      video_url: videoUrl,
      text,
      access_token: accessToken,
    }),
  });
  if (!containerRes.ok) {
    const body = await containerRes.text().catch((err) => {
      logger.warn('Failed to read Threads container response', {
        error: String(err),
        context: 'ThreadsPublisher.upload',
      });
      return '';
    });
    throw new Error(`Threads container creation failed (${containerRes.status}): ${body.slice(0, 300)}`);
  }
  const containerData = (await containerRes.json()) as ThreadsCreateResponse;
  if (!containerData.id) {
    throw new Error(`Threads container returned no id: ${containerData.error?.message ?? 'unknown'}`);
  }

  const publishRes = await fetch(`${THREADS_BASE}/${userId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerData.id,
      access_token: accessToken,
    }),
  });
  if (!publishRes.ok) {
    const body = await publishRes.text().catch((err) => {
      logger.warn('Failed to read Threads publish response', {
        error: String(err),
        context: 'ThreadsPublisher.upload',
      });
      return '';
    });
    throw new Error(`Threads publish failed (${publishRes.status}): ${body.slice(0, 300)}`);
  }
  const publishData = (await publishRes.json()) as ThreadsCreateResponse;
  if (!publishData.id) {
    throw new Error(`Threads publish returned no post id: ${publishData.error?.message ?? 'unknown'}`);
  }
  return publishData.id;
}

export function parseThreadsInsights(data: ThreadsInsightsResponse): MetricsJson {
  const findNum = (name: string): number => {
    const v = data.data?.find((m) => m.name === name)?.values?.[0]?.value;
    return typeof v === 'number' ? v : 0;
  };
  return {
    views: findNum('views'),
    likes: findNum('likes'),
    comments: findNum('replies'),
  };
}
