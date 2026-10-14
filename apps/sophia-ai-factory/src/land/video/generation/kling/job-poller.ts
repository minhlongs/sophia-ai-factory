/**
 * Polling and result retrieval logic for Kling video jobs
 *
 * @module land/video/generation/kling/job-poller
 */

import {
  shouldAllowRequest,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type {
  ProviderVideoJobStatus,
  KlingJobStatusResponse,
} from '../../templates/types';
import { KlingVideoClientError } from './types';
import { handleKlingErrorResponse } from './response-handler';

export async function pollKlingJobStatus(
  baseUrl: string,
  apiKey: string,
  timeoutMs: number,
  jobId: string,
): Promise<ProviderVideoJobStatus> {
  if (!shouldAllowRequest('kling')) {
    throw new KlingVideoClientError(
      0,
      'Circuit breaker open for Kling — too many failures',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/requests/${jobId}/status`, {
      headers: {
        Authorization: `Key ${apiKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      await handleKlingErrorResponse(response);
    }

    const statusResult = (await response.json()) as KlingJobStatusResponse;
    const falStatus = statusResult.status;

    if (falStatus === 'COMPLETED') {
      const resultResponse = await fetch(`${baseUrl}/requests/${jobId}`, {
        headers: { Authorization: `Key ${apiKey}` },
        signal: controller.signal,
      });

      if (!resultResponse.ok) {
        await handleKlingErrorResponse(resultResponse);
      }

      const resultData = (await resultResponse.json()) as {
        video?: { url: string };
        error?: string;
      };
      return {
        status: 'succeeded',
        videoUrl: resultData.video?.url,
        error: resultData.error,
      };
    }

    if (falStatus === 'FAILED') {
      return {
        status: 'failed',
        error: statusResult.error ?? 'Kling generation failed',
      };
    }

    const mappedStatus =
      falStatus === 'IN_PROGRESS' ? 'processing' : 'starting';
    return { status: mappedStatus };
  } catch (error) {
    if (error instanceof KlingVideoClientError) throw error;
    const kind = classifyError(error);
    recordFailure('kling', kind);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
