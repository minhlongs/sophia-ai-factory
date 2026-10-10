import { classifyError } from '@/seed/types/failure-kind';
import { recordFailure } from '@/seed/security/circuit-breaker';
import { logger } from '@/seed/utils/logger-utility';
import { SERVICE_NAME } from './types';

/**
 * Handle HTTP error responses from OpenRouter, classify failure kind, and update circuit breaker.
 */
export async function handleHttpError(response: Response, contextMethod: string): Promise<never> {
  let errorBody = '';
  try {
    errorBody = await response.text();
  } catch (err) {
    logger.warn('Failed to read OpenRouter error response body', undefined, {
      error: String(err),
      context: contextMethod,
    });
  }

  const error = new Error(`OpenRouter HTTP ${response.status}: ${errorBody.slice(0, 300)}`);
  (error as { status?: number; retryable?: boolean }).status = response.status;

  if (response.status === 401 || response.status === 403) {
    (error as { retryable?: boolean }).retryable = false;
  } else if (response.status === 429 || response.status >= 500) {
    (error as { retryable?: boolean }).retryable = true;
  } else {
    (error as { retryable?: boolean }).retryable = false;
  }

  const kind = classifyError(error);
  recordFailure(SERVICE_NAME, kind);
  throw error;
}
