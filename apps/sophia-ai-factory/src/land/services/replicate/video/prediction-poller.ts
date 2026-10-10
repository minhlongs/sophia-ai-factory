import { VideoStatus } from '../../types';
import {
  ReplicatePrediction,
  ReplicateJobStatus,
  ReplicateClientError,
} from './types';
import { ProviderNetworkError } from '@/seed/services/errors';
import { logger } from '@/seed/utils/logger-utility';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { handleReplicateErrorResponse } from './model-dispatcher';

export function mapStatus(replicateStatus: ReplicateJobStatus): VideoStatus['status'] {
  switch (replicateStatus) {
    case 'starting':
    case 'processing':
      return 'processing';
    case 'succeeded':
      return 'completed';
    case 'failed':
    case 'canceled':
      return 'failed';
    default:
      return 'pending';
  }
}

export function extractOutputUrl(prediction: ReplicatePrediction): string | undefined {
  if (!prediction.output) return undefined;
  return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
}

export async function storeToR2(videoId: string, sourceUrl: string): Promise<string> {
  const r2 = await getVideoBucket();

  if (!r2) {
    logger.warn('[ReplicateVideoService] R2 binding unavailable — using Replicate URL as fallback', {
      videoId,
    });
    return sourceUrl;
  }

  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    logger.error('[ReplicateVideoService] Failed to download video from Replicate URL', {
      videoId,
      error: err instanceof Error ? err.message : String(err),
    });
    return sourceUrl;
  }

  if (!response.ok) {
    logger.error('[ReplicateVideoService] Download failed', {
      videoId,
      status: response.status,
    });
    return sourceUrl;
  }

  const body = await response.arrayBuffer();
  const key = `replicate/${videoId}/${Date.now()}.mp4`;

  try {
    await r2.bucket.put(key, body, {
      httpMetadata: { contentType: 'video/mp4' },
    });
  } catch (err) {
    logger.error('[ReplicateVideoService] R2 upload failed', {
      videoId,
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return sourceUrl;
  }

  const permanentUrl = r2.publicBaseUrl ? `${r2.publicBaseUrl}/${key}` : sourceUrl;
  logger.info('[ReplicateVideoService] Video stored in R2', {
    videoId,
    key,
    sizeBytes: body.byteLength,
  });
  return permanentUrl;
}

export async function pollPrediction(options: {
  baseUrl: string;
  apiKey: string;
  videoId: string;
  timeoutMs: number;
  keyRef?: string;
}): Promise<VideoStatus> {
  const { baseUrl, apiKey, videoId, timeoutMs, keyRef } = options;

  if (!shouldAllowRequest('replicate', keyRef)) {
    throw new ProviderNetworkError('replicate', 'Circuit breaker open — too many failures');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/predictions/${videoId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      await handleReplicateErrorResponse(response);
    }

    const prediction = (await response.json()) as ReplicatePrediction;
    const status = mapStatus(prediction.status);
    const videoUrl = extractOutputUrl(prediction);
    let permanentUrl: string | undefined;

    if (status === 'completed' && videoUrl) {
      permanentUrl = await storeToR2(videoId, videoUrl);
    }

    recordSuccess('replicate', keyRef);
    return {
      id: videoId,
      status,
      video_url: permanentUrl ?? videoUrl,
      error: prediction.error,
    };
  } catch (error) {
    const kind = classifyError(error);
    recordFailure('replicate', kind, keyRef);

    if (error instanceof ReplicateClientError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ProviderNetworkError(
        'replicate',
        `Status poll timed out after ${timeoutMs}ms`,
      );
    }
    throw new ProviderNetworkError(
      'replicate',
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timer);
  }
}
