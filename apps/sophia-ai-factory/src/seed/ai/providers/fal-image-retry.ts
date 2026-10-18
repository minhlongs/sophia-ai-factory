/**
 * @module seed/ai/providers/fal-image-retry
 *
 * Bounded retry/backoff and error sanitization helpers for fal.ai image requests.
 */

import { ImageGenerationError } from '../image-generation-provider';
import { recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';
import type { Logger } from '@/seed/utils/logger-utility';

export const MAX_RETRIES = 3;
export const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000] as const;

export interface FalImageFetchResult {
  imageUrl: string;
  seed: number | undefined;
  timings: { inference: number | undefined } | undefined;
  width: number | undefined;
  height: number | undefined;
  contentType: string | undefined;
}

export function isRetryableKind(kind: FailureKind): boolean {
  return (
    kind === FailureKind.RATE_LIMIT
    || kind === FailureKind.SERVER_ERROR
    || kind === FailureKind.TIMEOUT
    || kind === FailureKind.NETWORK
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Defensively strip credential material from any error string. */
export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/Key\s+\S+/gi, 'Key <redacted>');
}

/**
 * Wrap a single-attempt executor with bounded retry/backoff. Logs each retry
 * via the requestId-scoped logger. Throws the last error after MAX_RETRIES.
 */
export async function fetchWithRetry(params: {
  providerId: string;
  keyRef: string;
  log: Logger;
  attempt: () => Promise<FalImageFetchResult>;
}): Promise<{ result: FalImageFetchResult; attempts: number }> {
  const { providerId, keyRef, log, attempt } = params;
  let lastErr: ImageGenerationError | null = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const result = await attempt();
      if (i > 0) {
        log.info(`[${providerId}] succeeded on attempt ${i + 1}/${MAX_RETRIES}`);
      }
      recordSuccess(providerId, keyRef);
      return { result, attempts: i + 1 };
    } catch (err) {
      if (err instanceof ImageGenerationError) {
        lastErr = err;
      } else {
        const kind = classifyError(err);
        recordFailure(providerId, kind, keyRef);
        lastErr = new ImageGenerationError(sanitizeErrorMessage(err), kind, providerId, isRetryableKind(kind));
      }

      if (!lastErr.retryable || i === MAX_RETRIES - 1) {
        log.warn(`[${providerId}] generation failed (attempt ${i + 1}/${MAX_RETRIES})`, {
          code: lastErr.code,
          retryable: lastErr.retryable,
        });
        lastErr.retryCount = i + 1;
        throw lastErr;
      }

      const backoffMs = RETRY_BACKOFF_MS[i] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      log.warn(`[${providerId}] retryable error — backing off ${backoffMs}ms (attempt ${i + 1}/${MAX_RETRIES})`, {
        code: lastErr.code,
      });
      await sleep(backoffMs);
    }
  }

  throw lastErr ?? new ImageGenerationError(`${providerId} generation failed`, 'UNKNOWN', providerId, false);
}
