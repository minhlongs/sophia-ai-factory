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
  resolveMuApiFunding,
  resolveMuApiBreakerKeyRef,
  normalizeMuApiJobStatus,
  isModelSupported,
  type MuApiFunding,
  type ResolvedMuApiFunding,
  type MediaType,
  type JobStatus,
  type MediaGenerationRequest,
  type MediaJob,
  type MediaGenerationResult,
} from './muapi-media-types';
import { getJobStatus } from './muapi-job-poller';

export {
  SUPPORTED_MODELS,
  resolveMuApiFunding,
  isModelSupported,
  getJobStatus,
  type MuApiFunding,
  type ResolvedMuApiFunding,
  type MediaType,
  type JobStatus,
  type MediaGenerationRequest,
  type MediaJob,
  type MediaGenerationResult,
};

const BYOK_CLIENT_ERROR_STATUSES = new Set([401, 402, 403, 429]);

async function handleNonOkMuApiResponse(
  res: Response,
  fund: 'byok' | 'platform',
): Promise<MediaGenerationResult> {
  const errBody = await res.text().catch((err) => {
    logger.warn('Failed to read MuAPI error response', { error: String(err), context: 'submitMediaJob' });
    return '';
  });
  if (fund === 'byok' && BYOK_CLIENT_ERROR_STATUSES.has(res.status)) {
    logger.warn('[MuAPI] BYOK upstream rejection', { status: res.status });
  } else {
    logger.error(`[MuAPI] ${res.status} error body: ${errBody}`);
  }
  const snippet = errBody.length > 200 ? `${errBody.slice(0, 200)}…` : errBody;
  return { success: false, error: `MuAPI ${res.status}${snippet ? ` ${snippet}` : ''}` };
}

function parseSubmitMediaJobPayload(
  data: { id?: unknown; status?: unknown; created_at?: unknown } | null,
  req: MediaGenerationRequest,
): MediaGenerationResult {
  const jobId = typeof data?.id === 'string' ? data.id.trim() : '';
  const status = normalizeMuApiJobStatus(data?.status, 'pending');
  if (!jobId || !status) {
    logger.error('[MuAPI] Invalid /generate response payload');
    return {
      success: false,
      error: 'Invalid MuAPI generate response',
      code: 'INVALID_PROVIDER_RESPONSE',
    };
  }
  return {
    success: true,
    job: {
      id: jobId,
      status,
      type: req.type,
      model: req.model,
      createdAt:
        typeof data?.created_at === 'string' && data.created_at
          ? data.created_at
          : new Date().toISOString(),
    },
  };
}

/**
 * Submit a media generation job to muapi.ai.
 * Requires explicit `MuApiFunding` so callers cannot fall back onto operator
 * credentials by omitting an argument.
 */
export async function submitMediaJob(
  req: MediaGenerationRequest,
  funding: MuApiFunding,
): Promise<MediaGenerationResult> {
  const resolvedFunding = resolveMuApiFunding(funding);
  if (!resolvedFunding.ok) {
    return {
      success: false,
      error: resolvedFunding.error,
      code: resolvedFunding.code,
    };
  }

  const keyRef = await resolveMuApiBreakerKeyRef(resolvedFunding);
  if (!shouldAllowRequest('muapi', keyRef)) {
    return { success: false, error: 'Circuit breaker open for muapi' };
  }
  try {
    const res = await fetch(`${MUAPI_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolvedFunding.apiKey}`,
      },
      body: JSON.stringify({
        type: req.type, model: req.model, prompt: req.prompt,
        negative_prompt: req.negativePrompt, aspect_ratio: req.aspectRatio || '16:9',
        duration: req.duration, style: req.style, seed: req.seed, image_url: req.imageUrl,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return await handleNonOkMuApiResponse(res, resolvedFunding.fund);
    }

    const data = (await res.json()) as {
      id?: unknown;
      status?: unknown;
      created_at?: unknown;
    } | null;

    const parsedResult = parseSubmitMediaJobPayload(data, req);
    if (parsedResult.success) {
      recordSuccess('muapi', keyRef);
    }
    return parsedResult;
  } catch (err) {
    recordFailure('muapi', classifyError(err), keyRef);
    return { success: false, error: toError(err).message };
  }
}
