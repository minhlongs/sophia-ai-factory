/**
 * Platform Upload Executor
 *
 * Performs the actual HTTP upload for a social publish job. The request
 * builders in this folder produce the endpoint/headers/body; this module is
 * the only place that talks to a provider.
 *
 * Honesty contract: this module NEVER invents a platform post id or a
 * published URL. A post id and URL exist here only if the provider returned
 * them. Anything else is a thrown error, classified by failure kind.
 *
 * Layer: tree (domain reusable logic — imports seed only)
 * @module tree/social/publisher/upload-executor
 */

import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';
import {
  buildYouTubeInitRequest,
  parseTikTokPublishStatus,
  buildTikTokInitPayload,
  buildTikTokStatusPollingRequest,
  buildInstagramContainerInit,
  buildInstagramPublishRequest,
} from './platform-adapters';

/**
 * Circuit-breaker key. Deliberately per platform, not per channel.
 *
 * `breakerKey` is unnormalized string concatenation and `shouldAllowRequest`
 * returns `true` for an unknown key, so a per-channel key is defeated simply
 * by varying the caller-supplied `channelId`: every new channel starts with a
 * clean breaker and a source that has been visibly failing keeps being served.
 * Platform-level keying makes a provider's repeated failures accumulate no
 * matter which channel they arrived on. `channelId` stays in the logs for
 * diagnosis.
 */
const BREAKER_KEY = (platform: SocialPlatform) => `social_upload:${platform}`;

export interface UploadExecutionInput {
  platform: SocialPlatform;
  accessToken: string;
  videoUrl: string;
  jobId: string;
  channelId: string;
  title: string;
  description: string;
  tags?: string[];
  totalSizeBytes?: number;
  /** Injectable for tests; production uses the global fetch. */
  fetchImpl?: typeof fetch;
}

export interface UploadExecutionResult {
  platformPostId: string;
  publishedUrl: string;
}

/**
 * Thrown when a provider accepts a request but the response cannot yield a
 * real post id. Distinct from an HTTP failure so callers can tell "provider
 * said no" apart from "we could not finish observing the provider".
 */
export class ProviderResultUnverifiableError extends Error {
  constructor(
    public readonly platform: SocialPlatform,
    public readonly reason: string,
  ) {
    super(`PROVIDER_RESULT_UNVERIFIABLE: ${platform} upload could not yield a real post id (${reason}).`);
    this.name = 'ProviderResultUnverifiableError';
  }
}

function assertOkResponse(res: Response): void {
  if (res.ok) return;
  throw new Error(`HTTP_${res.status}`);
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...headers },
    body: JSON.stringify(body),
  });
  assertOkResponse(res);
  return (await res.json()) as unknown;
}

function readString(source: unknown, path: readonly string[]): string {
  let cursor: unknown = source;
  for (const key of path) {
    if (typeof cursor !== 'object' || cursor === null) return '';
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === 'string' && cursor.length > 0 ? cursor : '';
}

async function uploadToYouTube(input: UploadExecutionInput, fetchImpl: typeof fetch): Promise<UploadExecutionResult> {
  const req = buildYouTubeInitRequest({
    title: input.title,
    description: input.description,
    tags: input.tags,
    totalSizeBytes: input.totalSizeBytes ?? 10 * 1024 * 1024,
  });

  const res = await fetchImpl(req.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'x-goog-api-format-version': '2',
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/*',
      'X-Upload-Content-Length': String(input.totalSizeBytes ?? 10 * 1024 * 1024),
    },
    body: JSON.stringify(req.body),
  });
  assertOkResponse(res);

  // The resumable-session URL is the provider's own handle for this upload.
  const location = res.headers.get('Location') ?? res.headers.get('location') ?? '';
  if (!location) {
    throw new ProviderResultUnverifiableError('YOUTUBE_SHORTS', 'resumable session URL absent in response headers');
  }

  // The media bytes live at a public URL; hand them to the session endpoint.
  const putRes = await fetchImpl(location, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'video/*',
    },
    body: JSON.stringify({ sourceUrl: input.videoUrl }),
  });
  assertOkResponse(putRes);
  const payload = (await putRes.json().catch(() => null)) as unknown;

  const videoId = readString(payload, ['id']);
  if (!videoId) {
    throw new ProviderResultUnverifiableError('YOUTUBE_SHORTS', 'no id in provider response');
  }
  return { platformPostId: videoId, publishedUrl: `https://www.youtube.com/shorts/${videoId}` };
}

async function uploadToTikTok(input: UploadExecutionInput, fetchImpl: typeof fetch): Promise<UploadExecutionResult> {
  const req = buildTikTokInitPayload({
    title: input.title,
    totalSizeBytes: input.totalSizeBytes ?? 10 * 1024 * 1024,
  });

  const payload = await postJson(req.endpoint, req.body, { Authorization: `Bearer ${input.accessToken}` }, fetchImpl);
  const publishId = readString(payload, ['data', 'publish_id']);
  if (!publishId) {
    throw new ProviderResultUnverifiableError('TIKTOK_V2', 'no publish_id in provider response');
  }

  const poll = buildTikTokStatusPollingRequest(publishId);
  const statusPayload = await postJson(poll.endpoint, poll.body, { Authorization: `Bearer ${input.accessToken}` }, fetchImpl);
  const parsed = parseTikTokPublishStatus(statusPayload);
  if (!parsed.isTerminal) {
    throw new ProviderResultUnverifiableError('TIKTOK_V2', `provider is still processing (${parsed.status}); not a confirmed publish`);
  }
  if (parsed.status === 'FAILED') {
    throw new ProviderResultUnverifiableError(
      'TIKTOK_V2',
      parsed.failReason ? `provider reported FAILED: ${parsed.failReason}` : 'provider reported FAILED',
    );
  }

  return { platformPostId: publishId, publishedUrl: `https://www.tiktok.com/@${input.channelId}/video/${publishId}` };
}

async function uploadToInstagram(input: UploadExecutionInput, fetchImpl: typeof fetch): Promise<UploadExecutionResult> {
  const container = buildInstagramContainerInit(input.channelId, {
    videoUrl: input.videoUrl,
    caption: input.description || input.title,
  });
  const containerPayload = await postJson(
    container.endpoint,
    container.body,
    { Authorization: `Bearer ${input.accessToken}` },
    fetchImpl,
  );

  const creationId = readString(containerPayload, ['id']);
  if (!creationId) {
    throw new ProviderResultUnverifiableError('INSTAGRAM_REELS', 'no container creation id in provider response');
  }

  const publish = buildInstagramPublishRequest(input.channelId, creationId);
  const publishPayload = await postJson(
    publish.endpoint,
    publish.body,
    { Authorization: `Bearer ${input.accessToken}` },
    fetchImpl,
  );

  // The container id is NOT a published media id: it is the handle the
  // container was created with, and a reel URL built from it points at an
  // unpublished container. Only an id from the publish response counts.
  const mediaId = readString(publishPayload, ['id']);
  if (!mediaId) {
    throw new ProviderResultUnverifiableError(
      'INSTAGRAM_REELS',
      'no published media id in provider response; the container id is not a live reel',
    );
  }
  return { platformPostId: mediaId, publishedUrl: `https://www.instagram.com/reel/${mediaId}/` };
}

/**
 * Executes a real provider upload. Every failure path records a classified
 * circuit-breaker failure and rethrows; the success path records success only
 * after a real provider id has been read from a real response.
 */
export async function executePlatformUpload(input: UploadExecutionInput): Promise<UploadExecutionResult> {
  const fetchImpl = input.fetchImpl ?? (globalThis.fetch as typeof fetch);
  const { platform, channelId, jobId } = input;

  if (!shouldAllowRequest(BREAKER_KEY(platform))) {
    throw new Error(`CIRCUIT_OPEN:${platform}`);
  }

  try {
    const result = platform === 'YOUTUBE_SHORTS'
      ? await uploadToYouTube(input, fetchImpl)
      : platform === 'TIKTOK_V2'
        ? await uploadToTikTok(input, fetchImpl)
        : await uploadToInstagram(input, fetchImpl);

    recordSuccess(BREAKER_KEY(platform));
    logger.info('executePlatformUpload: provider confirmed post id', {
      jobId,
      platform,
      channelId,
      idLength: result.platformPostId.length,
    });
    return result;
  } catch (err: unknown) {
    recordFailure(BREAKER_KEY(platform), classifyError(err));
    logger.warn('executePlatformUpload: provider upload failed', {
      jobId,
      platform,
      channelId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export { FailureKind };
