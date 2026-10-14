/**
 * MuAPI Media Generation Client
 *
 * REST client for muapi.ai — unified API for 100+ AI media models.
 * Supports image (Midjourney, Flux), video (Kling, Seedance, Veo3),
 * and audio (Suno, MMAudio) generation with async polling.
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import {
  MUAPI_BASE,
  SUPPORTED_MODELS,
  getMuApiKey,
  isModelSupported,
  type MediaType,
  type JobStatus,
  type MediaGenerationRequest,
  type MediaJob,
  type MediaGenerationResult,
} from './muapi-media-types';

export {
  SUPPORTED_MODELS,
  isModelSupported,
  type MediaType,
  type JobStatus,
  type MediaGenerationRequest,
  type MediaJob,
  type MediaGenerationResult,
};

/**
 * Submit a media generation job to muapi.ai
 */
export async function submitMediaJob(
  req: MediaGenerationRequest,
): Promise<MediaGenerationResult> {
  if (!shouldAllowRequest('muapi')) {
    return { success: false, error: 'Circuit breaker open for muapi' };
  }
  try {
    const res = await fetch(`${MUAPI_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getMuApiKey()}`,
      },
      body: JSON.stringify({
        type: req.type, model: req.model, prompt: req.prompt,
        negative_prompt: req.negativePrompt, aspect_ratio: req.aspectRatio || '16:9',
        duration: req.duration, style: req.style, seed: req.seed, image_url: req.imageUrl,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch((err) => {
        logger.warn('Failed to read MuAPI error response', { error: String(err), context: 'submitMediaJob' });
        return '';
      });
      logger.error(`[MuAPI] ${res.status} error body: ${errBody}`);
      const snippet = errBody.length > 200 ? `${errBody.slice(0, 200)}…` : errBody;
      return { success: false, error: `MuAPI ${res.status}${snippet ? ` ${snippet}` : ''}` };
    }

    const data = (await res.json()) as {
      id: string;
      status: string;
      created_at: string;
    };

    recordSuccess('muapi');
    return {
      success: true,
      job: {
        id: data.id,
        status: (data.status as JobStatus) || 'pending',
        type: req.type,
        model: req.model,
        createdAt: data.created_at,
      },
    };
  } catch (err) {
    recordFailure('muapi', classifyError(err));
    return { success: false, error: toError(err).message };
  }
}

/**
 * Poll job status from muapi.ai
 */
export async function getJobStatus(jobId: string): Promise<MediaGenerationResult> {
  if (!shouldAllowRequest('muapi')) {
    return { success: false, error: 'Circuit breaker open for muapi' };
  }
  try {
    const res = await fetch(`${MUAPI_BASE}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${getMuApiKey()}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { success: false, error: `MuAPI ${res.status}` };
    }

    const data = (await res.json()) as {
      id: string;
      status: string;
      type: string;
      model: string;
      result_url?: string;
      thumbnail_url?: string;
      progress?: number;
      error?: string;
      created_at: string;
      completed_at?: string;
    };

    recordSuccess('muapi');
    return {
      success: true,
      job: {
        id: data.id,
        status: data.status as JobStatus,
        type: data.type as MediaType,
        model: data.model,
        resultUrl: data.result_url,
        thumbnailUrl: data.thumbnail_url,
        progress: data.progress,
        error: data.error,
        createdAt: data.created_at,
        completedAt: data.completed_at,
      },
    };
  } catch (err) {
    recordFailure('muapi', classifyError(err));
    return { success: false, error: toError(err).message };
  }
}
