/**
 * Platform Upload Executor — performs HTTP uploads for social publish jobs.
 * Never invents a platform post id or URL; only provider-returned IDs succeed.
 * Layer: tree (domain reusable logic — imports seed/tree only)
 * @module tree/social/publisher/upload-executor
 */

import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';
import { isProvenanceBlockedError } from '@/tree/publishing/synthetic-media-disclosure';
import {
  buildYouTubeInitRequest,
  parseTikTokPublishStatus,
  buildTikTokInitPayload,
  buildTikTokStatusPollingRequest,
  buildInstagramContainerInit,
  buildInstagramPublishRequest,
} from './platform-adapters';
import {
  fetchTikTokCreatorInfo,
  isDurationAllowed,
  resolveTikTokPublishPlan,
  logPublishDowngrade,
  CreatorInfoUnavailableError,
} from './tiktok-creator-info';
import {
  assertOkResponse,
  postInstagramStep,
  postJson,
  readString,
  ProviderResultUnverifiableError,
  type UploadExecutionInput,
  type UploadExecutionResult,
} from './upload-executor-http';

export { ProviderResultUnverifiableError, type UploadExecutionInput, type UploadExecutionResult };

/** Circuit-breaker key per platform so varying `channelId` cannot reset a failing provider's breaker. */
const BREAKER_KEY = (platform: SocialPlatform) => `social_upload:${platform}`;

async function uploadToYouTube(
  input: UploadExecutionInput,
  req: ReturnType<typeof buildYouTubeInitRequest>,
  fetchImpl: typeof fetch,
): Promise<UploadExecutionResult> {
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

  const location = res.headers.get('Location') ?? res.headers.get('location') ?? '';
  if (!location) {
    throw new ProviderResultUnverifiableError('YOUTUBE_SHORTS', 'resumable session URL absent in response headers');
  }

  const putRes = await fetchImpl(location, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${input.accessToken}`, 'Content-Type': 'video/*' },
    body: JSON.stringify({ sourceUrl: input.videoUrl }),
  });
  assertOkResponse(putRes);
  const payload = (await putRes.json().catch(() => null)) as unknown;
  const videoId = readString(payload, ['id']);
  if (!videoId) throw new ProviderResultUnverifiableError('YOUTUBE_SHORTS', 'no id in provider response');
  return { platformPostId: videoId, publishedUrl: `https://www.youtube.com/shorts/${videoId}` };
}

async function uploadToTikTok(input: UploadExecutionInput, fetchImpl: typeof fetch): Promise<UploadExecutionResult> {
  // Query creator_info first because TikTok answers an unaudited publish with HTTP 200 + SELF_ONLY.
  const capabilities = await fetchTikTokCreatorInfo(input.accessToken, fetchImpl);
  const plan = resolveTikTokPublishPlan({ capabilities, requested: 'public', onUnavailable: 'downgrade' });
  if (plan.downgraded) logPublishDowngrade({ channelId: input.channelId, jobId: input.jobId, plan });

  if (input.durationSeconds !== undefined && !isDurationAllowed(capabilities, input.durationSeconds)) {
    throw new CreatorInfoUnavailableError(
      `video is ${input.durationSeconds}s but this creator may publish at most ${capabilities.maxVideoDurationSeconds}s`,
    );
  }

  const req = buildTikTokInitPayload({
    title: input.title,
    totalSizeBytes: input.totalSizeBytes ?? 10 * 1024 * 1024,
    privacyLevel: plan.privacyLevel,
    disableComment: plan.disableComment,
    disableDuet: plan.disableDuet,
    disableStitch: plan.disableStitch,
  });

  const payload = await postJson(req.endpoint, req.body, { Authorization: `Bearer ${input.accessToken}` }, fetchImpl);
  const publishId = readString(payload, ['data', 'publish_id']);
  if (!publishId) throw new ProviderResultUnverifiableError('TIKTOK_V2', 'no publish_id in provider response');

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
  const creationId = await postInstagramStep(
    container.endpoint,
    container.body,
    input.accessToken,
    fetchImpl,
    'no container creation id in provider response',
  );
  const publish = buildInstagramPublishRequest(input.channelId, creationId);
  const mediaId = await postInstagramStep(
    publish.endpoint,
    publish.body,
    input.accessToken,
    fetchImpl,
    'no published media id in provider response; the container id is not a live reel',
  );
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

  // Validate YouTube provenance synchronously BEFORE touching the shared
  // platform circuit breaker so one tenant's unverified claim never trips or
  // advances the breaker state for other tenants.
  const youtubeInitReq = platform === 'YOUTUBE_SHORTS'
    ? buildYouTubeInitRequest({
        title: input.title,
        description: input.description,
        tags: input.tags,
        totalSizeBytes: input.totalSizeBytes ?? 10 * 1024 * 1024,
        containsSyntheticMedia: input.containsSyntheticMedia,
        provenance: input.provenance,
      })
    : null;

  if (!shouldAllowRequest(BREAKER_KEY(platform))) {
    throw new Error(`CIRCUIT_OPEN:${platform}`);
  }

  try {
    const result = youtubeInitReq
      ? await uploadToYouTube(input, youtubeInitReq, fetchImpl)
      : platform === 'TIKTOK_V2'
        ? await uploadToTikTok(input, fetchImpl)
        : await uploadToInstagram(input, fetchImpl);

    recordSuccess(BREAKER_KEY(platform));
    logger.info('executePlatformUpload: provider confirmed post id', {
      jobId, platform, channelId, idLength: result.platformPostId.length,
    });
    return result;
  } catch (err: unknown) {
    if (!isProvenanceBlockedError(err)) {
      recordFailure(BREAKER_KEY(platform), classifyError(err));
    }
    logger.warn('executePlatformUpload: provider upload failed', {
      jobId, platform, channelId, error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export { FailureKind };
