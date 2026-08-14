/**
 * Error Bucketing Utility
 *
 * Classifies errors into two buckets with different handling strategies:
 * - BUCKET_A: Intentional best-effort cleanup (one-line comment OK)
 * - BUCKET_B: External or control-flow-changing errors (must log + rethrow)
 *
 * Pattern adopted from OmniRoute's two-bucket error handling.
 */

export type ErrorBucket = 'best-effort' | 'external';

export interface BucketedError {
  bucket: ErrorBucket;
  error: Error;
  context?: string;
  shouldLog: boolean;
  shouldRethrow: boolean;
}

/**
 * Classify an error into a handling bucket.
 *
 * BUCKET_A (best-effort): Resource cleanup failures, non-critical side effects.
 *   → Log optional, rethrow optional. One-line rationale comment sufficient.
 *
 * BUCKET_B (external/control-flow): External API failures, auth errors, validation errors.
 *   → MUST log with context, MUST rethrow or return Result.failure.
 */
export function classifyErrorBucket(
  error: Error,
  context?: string,
): BucketedError {
  const isExternal = isExternalError(error);
  const isValidation = error.name === 'ZodError' || error.name === 'ValidationError';
  const isAuth = error.name === 'AuthError' || error.name === 'UnauthorizedError';

  if (isExternal || isValidation || isAuth) {
    return {
      bucket: 'external',
      error,
      context,
      shouldLog: true,
      shouldRethrow: true,
    };
  }

  return {
    bucket: 'best-effort',
    error,
    context,
    shouldLog: false,
    shouldRethrow: false,
  };
}

/**
 * Check if an error originates from an external service call.
 */
function isExternalError(error: Error): boolean {
  const message = error.message?.toLowerCase() ?? '';
  return (
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('enotfound') ||
    message.includes('socket hang up') ||
    error.name === 'TypeError' && message.includes('network')
  );
}

/**
 * Helper for best-effort cleanup patterns.
 * Usage: await bestEffortCleanup(() => resource.release(), 'resource cleanup');
 */
export async function bestEffortCleanup(
  fn: () => Promise<void>,
  description: string,
): Promise<void> {
  try {
    await fn();
  } catch {
    // Best-effort: {description} may already be released
  }
}
