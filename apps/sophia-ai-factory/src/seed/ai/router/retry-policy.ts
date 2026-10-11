/**
 * Analyzes whether an AI provider failure is eligible for automatic fallback retry.
 */
export function isRetryableError(error: Error): boolean {
  const retryableFlag = (error as { retryable?: boolean }).retryable;
  if (retryableFlag === false) return false;
  if (retryableFlag === true) return true;

  const msg = error.message.toLowerCase();

  if (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('invalid key') ||
    msg.includes('auth failed')
  ) {
    return false;
  }
  if (msg.includes('400') || msg.includes('bad request') || msg.includes('invalid request')) {
    return false;
  }
  if (
    msg.includes('5xx') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('network') ||
    msg.includes('circuit breaker')
  ) {
    return true;
  }

  return true;
}
