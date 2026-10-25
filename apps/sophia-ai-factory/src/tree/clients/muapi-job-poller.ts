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
  getMuApiKey,
  type MediaType,
  type JobStatus,
  type MediaGenerationResult,
} from './muapi-media-types';

/**
 * Poll job status from muapi.ai
 */
export async function getJobStatus(
  jobId: string,
  apiKey?: string,
): Promise<MediaGenerationResult> {
  if (!shouldAllowRequest('muapi')) {
    return { success: false, error: 'Circuit breaker open for muapi' };
  }
  const resolvedKey = apiKey || getMuApiKey();
  try {
    const res = await fetch(`${MUAPI_BASE}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${resolvedKey}` },
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
