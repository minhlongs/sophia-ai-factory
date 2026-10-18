/**
 * @module forest/ai/providers/kling-status-poller
 * Status polling and input normalization helpers for Kling AI Video Client.
 * Layer: forest — imports seed only.
 */

import type {
  VideoRenderInput,
  VideoRenderStatus,
} from '@/seed/ai/multimodal-provider-interface';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';

export function resolveKlingRenderParams(input: VideoRenderInput): {
  prompt: string;
  duration: number;
  aspectRatio: string;
} {
  const prompt =
    input.script ||
    (input.options?.topic as string) ||
    (input.options?.scenes as Array<{ prompt?: string }>)?.[0]?.prompt ||
    'Cinematic high-definition video scene';
  const duration = typeof input.options?.duration === 'number' ? input.options.duration : 5;
  const aspectRatio = (input.options?.aspectRatio as string) || '16:9';
  return { prompt, duration, aspectRatio };
}

export async function pollKlingJobStatus(params: {
  baseUrl: string;
  apiKey: string;
  jobId: string;
  effectiveKeyRef: string;
}): Promise<VideoRenderStatus> {
  const { baseUrl, apiKey, jobId, effectiveKeyRef } = params;
  if (!shouldAllowRequest('kling', effectiveKeyRef)) {
    throw new Error(`[Kling] Circuit breaker open for kling (${effectiveKeyRef})`);
  }

  try {
    const response = await fetch(`${baseUrl}/requests/${jobId}/status`, {
      headers: { Authorization: `Key ${apiKey}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      recordFailure('kling', classifyHttpStatus(response.status), effectiveKeyRef);
      throw new Error(`Kling checkStatus failed: ${response.status} - ${errText}`);
    }

    const statusResult = (await response.json()) as { status: string; error?: string };
    recordSuccess('kling', effectiveKeyRef);

    if (statusResult.status === 'COMPLETED') {
      const resResponse = await fetch(`${baseUrl}/requests/${jobId}`, {
        headers: { Authorization: `Key ${apiKey}` },
      });
      if (resResponse.ok) {
        const resData = (await resResponse.json()) as { video?: { url?: string } };
        return { status: 'completed', videoUrl: resData.video?.url };
      }
      return { status: 'completed' };
    }

    if (statusResult.status === 'FAILED') {
      return { status: 'failed', error: statusResult.error || 'Kling video generation failed' };
    }

    return { status: statusResult.status === 'IN_PROGRESS' ? 'processing' : 'pending' };
  } catch (err) {
    if (!(err instanceof Error && err.message.includes('Circuit breaker'))) {
      recordFailure('kling', classifyError(err), effectiveKeyRef);
    }
    throw err;
  }
}
