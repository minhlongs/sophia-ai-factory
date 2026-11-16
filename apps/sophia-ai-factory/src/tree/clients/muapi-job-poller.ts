/**
 * MuAPI Media Job Status Poller
 *
 * @module tree/clients/muapi-job-poller
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { toError } from '@/seed/utils/to-error';
import {
  MUAPI_BASE,
  resolveMuApiFunding,
  resolveMuApiBreakerKeyRef,
  normalizeMuApiJobStatus,
  isSafeMuApiJobId,
  type MuApiFunding,
  type MediaType,
  type MediaGenerationResult,
} from './muapi-media-types';

/**
 * Poll job status from muapi.ai.
 * Requires explicit `MuApiFunding` so callers cannot fall back onto operator
 * credentials by omitting an argument.
 */
export async function getJobStatus(
  jobId: string,
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

  if (!isSafeMuApiJobId(jobId)) {
    return {
      success: false,
      error: 'Invalid jobId',
      code: 'INVALID_JOB_ID',
    };
  }

  const keyRef = await resolveMuApiBreakerKeyRef(resolvedFunding);
  if (!shouldAllowRequest('muapi', keyRef)) {
    return { success: false, error: 'Circuit breaker open for muapi' };
  }
  try {
    const res = await fetch(`${MUAPI_BASE}/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${resolvedFunding.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { success: false, error: `MuAPI ${res.status}` };
    }

    const data = (await res.json()) as {
      id?: unknown;
      status?: unknown;
      type?: unknown;
      model?: unknown;
      result_url?: string;
      thumbnail_url?: string;
      progress?: number;
      error?: string;
      created_at?: string;
      completed_at?: string;
    } | null;

    const resolvedId = typeof data?.id === 'string' && data.id.trim() ? data.id.trim() : jobId;
    const normalizedStatus = normalizeMuApiJobStatus(data?.status);
    if (!normalizedStatus) {
      return {
        success: false,
        error: 'Invalid MuAPI job status response',
        code: 'INVALID_PROVIDER_RESPONSE',
      };
    }

    recordSuccess('muapi', keyRef);
    return {
      success: true,
      job: {
        id: resolvedId,
        status: normalizedStatus,
        type: (typeof data?.type === 'string' ? data.type : 'video') as MediaType,
        model: typeof data?.model === 'string' ? data.model : '',
        resultUrl: data?.result_url,
        thumbnailUrl: data?.thumbnail_url,
        progress: data?.progress,
        error: data?.error,
        createdAt: typeof data?.created_at === 'string' && data.created_at ? data.created_at : new Date(0).toISOString(),
        completedAt: data?.completed_at,
      },
    };
  } catch (err) {
    recordFailure('muapi', classifyError(err), keyRef);
    return { success: false, error: toError(err).message };
  }
}
