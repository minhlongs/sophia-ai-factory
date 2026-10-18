import { VideoStatus } from '../../types';
import {
  ReplicatePrediction,
  ReplicateJobStatus,
  ReplicateClientError,
} from './types';
import { ProviderNetworkError } from '@/seed/services/errors';
import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { handleReplicateErrorResponse } from './model-dispatcher';
import { storeToR2 } from './r2-video-storage';

export { storeToR2 };

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
