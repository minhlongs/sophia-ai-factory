/**
 * URL validation and resolution utilities for video publishing.
 * @module land/video/publishing/publish-url-utils
 */

import { createServerClient } from '@/seed/db/client';
import {
  getCanonicalVideoUrl,
  VideoNotFoundError,
  VideoUnauthorizedError,
} from '@/land/video/storage/get-canonical-video-url';
import { logger } from '@/seed/utils/logger-utility';

export function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.length > 200 ? raw.slice(0, 197) + '...' : raw;
}

export function assertSafeVideoUrl(url: string): void {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('[publishExecute] Malformed video URL: empty or non-string');
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`[publishExecute] Malformed video URL: ${url}`);
    }
    if (parsed.hostname) {
      const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0'];
      if (blockedHostnames.includes(parsed.hostname)) {
        throw new Error(`[publishExecute] Blocked untrusted video URL hostname: ${parsed.hostname}`);
      }
    }
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(`[publishExecute] Malformed video URL: ${url}`);
    }
    throw err;
  }
}

export async function resolveVideoUrlOrFail(args: {
  jobId: string;
  videoId: string;
  userId: string;
  db: ReturnType<typeof createServerClient>;
  logTag: string;
}): Promise<string> {
  const { jobId, videoId, userId, db, logTag } = args;
  try {
    return await getCanonicalVideoUrl(videoId, userId);
  } catch (err) {
    if (err instanceof VideoNotFoundError) {
      await db.from('publishing_jobs').update({
        status: 'failed',
        error: 'Video not found',
      }).eq('id', jobId);
      logger.warn(`[${logTag}] Video not found`, { jobId, videoId });
      throw err;
    }
    if (err instanceof VideoUnauthorizedError) {
      logger.warn(`[${logTag}] Permission denied resolving video URL`, { jobId, videoId, tenantId: userId });
      await db.from('publishing_jobs').update({
        status: 'failed',
        error: 'Permission denied',
      }).eq('id', jobId);
      throw err;
    }
    throw err;
  }
}

export function buildPostUrl(provider: string, externalPostId: string, externalAccountId?: string): string {
  if (provider === 'tiktok') {
    return externalAccountId
      ? `https://www.tiktok.com/@${externalAccountId}/video/${externalPostId}`
      : `https://www.tiktok.com/video/${externalPostId}`;
  }
  if (provider === 'youtube') return `https://www.youtube.com/watch?v=${externalPostId}`;
  if (provider === 'facebook') {
    return externalAccountId
      ? `https://www.facebook.com/${externalAccountId}/videos/${externalPostId}`
      : `https://www.facebook.com/watch/?v=${externalPostId}`;
  }
  if (provider === 'twitter') return `https://twitter.com/i/status/${externalPostId}`;
  if (provider === 'pinterest') return `https://www.pinterest.com/pin/${externalPostId}`;
  if (provider === 'linkedin') return `https://www.linkedin.com/feed/update/${externalPostId}`;
  if (provider === 'zalo') return `https://zalo.me/${externalPostId}`;
  return `https://www.instagram.com/p/${externalPostId}`;
}
