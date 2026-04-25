import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

/** Sentry error tracking (placeholder — integrate with actual Sentry SDK when available). */
export async function logErrorToSentry(
  error: Error,
  context: {
    eventId?: string;
    licenseNonce?: string;
    operation: string;
  }
): Promise<void> {
  logger.error('[Sentry] Error logged', toError(error), {
    eventId: context.eventId,
    licenseNonce: context.licenseNonce,
    operation: context.operation,
  });
}

/** Log error entry to reconciliation-errors KV namespace. TTL: 7 days. */
export async function logErrorToKv(
  error: Error,
  context: {
    eventId?: string;
    licenseNonce?: string;
    operation: string;
    timestamp: number;
  },
  kv: KVNamespace
): Promise<void> {
  try {
    const errorKey = `reconciliation-errors:${context.timestamp}:${context.licenseNonce || 'unknown'}`;
    const errorEntry = {
      eventId: context.eventId,
      licenseNonce: context.licenseNonce,
      operation: context.operation,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: context.timestamp,
    };
    await kv.put(errorKey, JSON.stringify(errorEntry), { expirationTtl: 7 * 24 * 60 * 60 });
  } catch (logError) {
    logger.error('[Reconciliation Runner] Failed to log error to KV', toError(logError));
  }
}
