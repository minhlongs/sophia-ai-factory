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
import { getJobStatus } from './muapi-job-poller';

export {
  SUPPORTED_MODELS,
  isModelSupported,
  getJobStatus,
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
  apiKey?: string,
): Promise<MediaGenerationResult> {
  if (!shouldAllowRequest('muapi')) {
    return { success: false, error: 'Circuit breaker open for muapi' };
  }
  const resolvedKey = apiKey || getMuApiKey();
  try {
    const res = await fetch(`${MUAPI_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolvedKey}`,
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
