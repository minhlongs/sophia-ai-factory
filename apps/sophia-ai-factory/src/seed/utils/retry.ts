import { logger } from '@/seed/utils/logger-utility';

export type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  context?: string;
};

/**
 * Retry a function with exponential backoff.
 * Logs each retry attempt via logger.
 * Throws if all retries are exhausted — caller should wrap with Result if needed.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30_000, context = 'withRetry' } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      logger.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`, {
        error: String(err),
        context,
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('unreachable');
}
