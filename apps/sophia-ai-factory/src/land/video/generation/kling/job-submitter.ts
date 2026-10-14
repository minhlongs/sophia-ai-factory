/**
 * Job submission logic for Kling video generation via fal.ai queue
 *
 * @module land/video/generation/kling/job-submitter
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type {
  VideoGenerateParams,
  VideoGenerateResult,
  KlingApiInput,
  KlingApiResponse,
} from '../../templates/types';
import { KlingVideoClientError } from './types';
import { handleKlingErrorResponse } from './response-handler';

export async function submitKlingVideoJob(
  baseUrl: string,
  apiKey: string,
  timeoutMs: number,
  params: VideoGenerateParams,
): Promise<VideoGenerateResult> {
  const input: KlingApiInput = {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio ?? '16:9',
    duration: params.duration ?? 5,
  };

  logger.info('[KlingVideoClient] Submitting video generation', {
    aspectRatio: input.aspect_ratio,
    duration: input.duration,
  });

  if (!shouldAllowRequest('kling')) {
    throw new KlingVideoClientError(
      0,
      'Circuit breaker open for Kling — too many failures',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      await handleKlingErrorResponse(response);
    }

    const result = (await response.json()) as KlingApiResponse;

    logger.info('[KlingVideoClient] Job submitted', {
      jobId: result.request_id,
      status: result.status,
    });

    recordSuccess('kling');
    return {
      jobId: result.request_id,
      status: 'starting',
    };
  } catch (error) {
    if (error instanceof KlingVideoClientError) throw error;
    const kind = classifyError(error);
    recordFailure('kling', kind);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
