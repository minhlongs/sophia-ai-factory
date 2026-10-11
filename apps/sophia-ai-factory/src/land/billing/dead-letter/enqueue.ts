/**
 * DLQ Enqueue and Resolve Operations
 * Layer: land/billing/dead-letter
 */

import { logger } from '@/seed/utils/logger-utility'
import { success, failure, type Result } from '@/seed/types/result'
import { DLQError } from '../nowpayments-ipn-errors'
import { DLQ_TABLE, type D1LikeClient, type EnqueueDlqOptions } from './types'

/**
 * Enqueue (or update) a DLQ entry.
 *
 * Uses UNIQUE(event_id) — if already present, increments retry_count
 * and updates last_attempted_at / failure_reason.
 */
export async function enqueueDlqEntry(
  db: D1LikeClient,
  opts: EnqueueDlqOptions,
): Promise<Result<void, DLQError>> {
  try {
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(opts.payload);

    const { error: insertError } = await db
      .from(DLQ_TABLE)
      .insert({
        event_id: opts.eventId,
        payment_id: opts.paymentId,
        payment_status: opts.paymentStatus,
        order_id: opts.orderId,
        payload: payloadJson,
        failure_reason: opts.failureReason,
        retry_count: opts.retryCount,
        first_failed_at: now,
        last_attempted_at: now,
        resolved: 0,
      });

    if (insertError) {
      const isUniqueViolation =
        typeof insertError === 'object' &&
        insertError !== null &&
        'code' in insertError &&
        (insertError as { code?: string }).code === '23505';

      if (isUniqueViolation || typeof insertError === 'string') {
        await db
          .from(DLQ_TABLE)
          .update({
            retry_count: opts.retryCount + 1,
            failure_reason: opts.failureReason,
            last_attempted_at: now,
          })
          .eq('event_id', opts.eventId)
          .eq('resolved', 0);
      } else {
        logger.error('[DLQ] Insert failed with unexpected error', {
          eventId: opts.eventId,
          error: insertError,
        });
        return failure(new DLQError('ENQUEUE_DLQ_FAILED', insertError));
      }
    }

    return success(undefined);
  } catch (err) {
    return failure(new DLQError('ENQUEUE_DLQ_FAILED', err));
  }
}

/**
 * Mark a DLQ entry as resolved.
 */
export async function resolveDlqEntry(
  db: D1LikeClient,
  eventId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .from(DLQ_TABLE)
    .update({ resolved: 1, resolved_at: now })
    .eq('event_id', eventId);
}
