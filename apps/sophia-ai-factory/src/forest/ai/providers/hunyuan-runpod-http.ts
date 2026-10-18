/**
 * @module forest/ai/providers/hunyuan-runpod-http
 * Runpod HTTP request execution helpers for HunyuanVideoClient.
 *
 * Layer: forest — imports seed only.
 */

import {
  type VideoRenderInput,
  type VideoRenderStatus,
} from '@/seed/ai/multimodal-provider-interface';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';

function classifyRunpodError(error: unknown) {
  if (error instanceof Error) {
    const status = error.message.match(/failed: (\d{3})\b/)?.[1];
    if (status) return classifyHttpStatus(Number(status));
  }
  return classifyError(error);
}

export interface RunpodHttpParams {
  apiKey: string;
  endpointId: string;
  baseUrl: string;
  effectiveKeyRef: string;
}

export async function executeRunpodRender(
  params: RunpodHttpParams,
  input: VideoRenderInput,
): Promise<{ jobId: string }> {
  const { apiKey, endpointId, baseUrl, effectiveKeyRef } = params;
  if (!shouldAllowRequest('runpod', effectiveKeyRef)) {
    throw new Error(`[HunyuanVideo] Circuit breaker open for runpod (${effectiveKeyRef})`);
  }

  const prompt =
    input.script ||
    (input.options?.topic as string) ||
    (input.options?.scenes as Array<{ prompt?: string }>)?.[0]?.prompt ||
    'Cinematic photorealistic video';
  const duration = typeof input.options?.duration === 'number' ? input.options.duration : 30;

  try {
    const response = await fetch(`${baseUrl}/${endpointId}/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt,
          duration,
          face_url: input.faceUrl,
          audio_url: input.audioUrl,
          fps: 30,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Runpod HunyuanVideo failed: ${response.status} - ${errText}`);
    }

    const result = (await response.json()) as { id: string };
    recordSuccess('runpod', effectiveKeyRef);
    return { jobId: result.id };
  } catch (err) {
    recordFailure('runpod', classifyRunpodError(err), effectiveKeyRef);
    throw err;
  }
}

export async function executeRunpodStatusCheck(
  params: RunpodHttpParams,
  jobId: string,
): Promise<VideoRenderStatus> {
  const { apiKey, endpointId, baseUrl, effectiveKeyRef } = params;
  if (!shouldAllowRequest('runpod', effectiveKeyRef)) {
    throw new Error(`[HunyuanVideo] Circuit breaker open for runpod (${effectiveKeyRef})`);
  }

  try {
    const response = await fetch(`${baseUrl}/${endpointId}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Runpod checkStatus failed: ${response.status} - ${errText}`);
    }

    const result = (await response.json()) as {
      status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
      output?: { download_url?: string };
      error?: string;
    };

    recordSuccess('runpod', effectiveKeyRef);

    if (result.status === 'COMPLETED') {
      return { status: 'completed', videoUrl: result.output?.download_url };
    }
    if (result.status === 'FAILED' || result.status === 'CANCELLED') {
      return { status: 'failed', error: result.error || `Runpod job status: ${result.status}` };
    }
    return { status: result.status === 'IN_PROGRESS' ? 'processing' : 'pending' };
  } catch (err) {
    recordFailure('runpod', classifyRunpodError(err), effectiveKeyRef);
    throw err;
  }
}
