/**
 * @module seed/ai/providers/fal-image-fetch
 *
 * Single-attempt fal.ai fetch execution + retry/backoff helpers for the
 * FalImageProvider. Split out to keep the provider class under 200 LOC.
 * Credential-safe: sanitizeErrorMessage redacts any leaked apiKey material.
 */

import { ImageGenerationError } from '../image-generation-provider';
import { recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError, FailureKind } from '@/seed/types/failure-kind';
import type { FalImageRequest, FalImageResponseSchema } from './fal-image-provider';
import {
  MAX_RETRIES,
  RETRY_BACKOFF_MS,
  isRetryableKind,
  sleep,
  sanitizeErrorMessage,
  fetchWithRetry,
  type FalImageFetchResult,
} from './fal-image-retry';

export {
  MAX_RETRIES,
  RETRY_BACKOFF_MS,
  isRetryableKind,
  sleep,
  sanitizeErrorMessage,
  fetchWithRetry,
};
export type { FalImageFetchResult };

/**
 * Execute a single fal.ai generation request. Throws ImageGenerationError on
 * any failure (HTTP error, network abort, invalid response). apiKey is never
 * included in thrown messages.
 */
export async function executeFalFetch(params: {
  baseUrl: string;
  model: string;
  apiKey: string;
  keyRef: string;
  providerId: string;
  requestBody: FalImageRequest;
  responseSchema: typeof FalImageResponseSchema;
  timeoutMs: number;
  timeoutOverride?: number;
}): Promise<FalImageFetchResult> {
  const { baseUrl, model, apiKey, keyRef, providerId, requestBody, responseSchema, timeoutMs, timeoutOverride } =
    params;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${apiKey}` },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutOverride ?? timeoutMs),
    });
  } catch (err) {
    if (err instanceof ImageGenerationError) throw err;
    const kind = classifyError(err);
    recordFailure(providerId, kind, keyRef);
    throw new ImageGenerationError(sanitizeErrorMessage(err), kind, providerId, isRetryableKind(kind));
  }

  if (!res.ok) {
    const kind = classifyHttpStatus(res.status);
    recordFailure(providerId, kind, keyRef);
    const errBody = await res.text().catch(() => '');
    const snippet = errBody.length > 200 ? `${errBody.slice(0, 200)}…` : errBody;
    const safeSnippet = sanitizeErrorMessage(snippet);
    throw new ImageGenerationError(
      `${providerId} ${res.status}${safeSnippet ? ` ${safeSnippet}` : ''}`,
      kind,
      providerId,
      isRetryableKind(kind),
    );
  }

  const raw = (await res.json()) as unknown;
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    recordFailure(providerId, FailureKind.UNKNOWN, keyRef);
    throw new ImageGenerationError(
      `${providerId} response validation failed: ${parsed.error.message}`,
      'INVALID_RESPONSE',
      providerId,
      false,
    );
  }

  return {
    imageUrl: parsed.data.images[0].url,
    seed: parsed.data.seed,
    timings: parsed.data.timings ? { inference: parsed.data.timings.inference } : undefined,
    width: parsed.data.images[0].width,
    height: parsed.data.images[0].height,
    contentType: parsed.data.images[0].content_type,
  };
}
