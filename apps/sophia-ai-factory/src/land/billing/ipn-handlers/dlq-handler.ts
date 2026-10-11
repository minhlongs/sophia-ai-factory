/**
 * DLQ handling and overflow guard for NOWPayments IPN
 * @module land/billing/ipn-handlers/dlq-handler
 */

import type { D1Client } from '@/seed/db/d1-client-rpc';
import { logger } from '@/seed/utils/logger-utility';
import { safeCatch } from '@/seed/utils/safe-catch';
import { enqueueDlqEntry, countUnresolvedDlq, type D1LikeClient } from '../nowpayments-ipn-dead-letter';
import { recordDroppedEvent } from '../nowpayments-ipn-dropped-events';
import { MAX_DLQ_RETRIES, DLQ_SIZE_CAP, type NowPaymentsIpnPayload } from './types';

export async function handleIpnDlq(
  db: D1Client,
  eventId: string,
  ipn: NowPaymentsIpnPayload,
  err: Error,
): Promise<{ success: boolean; message: string }> {
  const { payment_id, payment_status } = ipn;

  const dlqRow = await db
    .from('ipn_dead_letter_queue')
    .select('retry_count')
    .eq('event_id', eventId)
    .maybeSingle();

  const currentRetries = typeof dlqRow?.data?.retry_count === 'number'
    ? dlqRow.data.retry_count
    : 0;

  if (currentRetries >= MAX_DLQ_RETRIES) {
    logger.error(
      '[NOWPayments] DLQ_EXHAUSTED — permanent failure, alert required',
      { eventId, payment_id, payment_status, reason: err.message },
    );
    return { success: false, message: `Permanent failure after ${MAX_DLQ_RETRIES} retries: ${err.message}` };
  }

  // DLQ size guard with graduated thresholds
  const unresolvedDlqCount = await countUnresolvedDlq(db as unknown as D1LikeClient);

  // 50% warning threshold — operator should investigate
  if (unresolvedDlqCount >= DLQ_SIZE_CAP * 0.5 && unresolvedDlqCount < DLQ_SIZE_CAP * 0.9) {
    logger.warn('[NOWPayments] DLQ capacity warning', {
      unresolvedCount: unresolvedDlqCount,
      capacity: DLQ_SIZE_CAP,
      pct: Math.round((unresolvedDlqCount / DLQ_SIZE_CAP) * 100),
    });
  }

  // 90% critical threshold — near overflow, urgent action needed
  if (unresolvedDlqCount >= DLQ_SIZE_CAP * 0.9 && unresolvedDlqCount < DLQ_SIZE_CAP) {
    logger.error('[NOWPayments] DLQ capacity critical', {
      unresolvedCount: unresolvedDlqCount,
      capacity: DLQ_SIZE_CAP,
      pct: Math.round((unresolvedDlqCount / DLQ_SIZE_CAP) * 100),
    });
  }

  if (unresolvedDlqCount >= DLQ_SIZE_CAP) {
    try {
      await recordDroppedEvent(db as unknown as D1LikeClient, {
        eventId,
        paymentId: payment_id,
        paymentStatus: payment_status,
        orderId: ipn.order_id ?? '',
        payload: ipn as unknown as Record<string, unknown>,
        failureReason: err.message,
        dlqSize: unresolvedDlqCount,
      });
    } catch (recordErr) {
      safeCatch('Record dropped event')(recordErr);
    }

    logger.error('[NOWPayments] DLQ_OVERFLOW — event recorded as dropped', {
      eventId,
      unresolvedCount: unresolvedDlqCount,
    });
    return {
      success: false,
      message: `DLQ at capacity (${unresolvedDlqCount}/${DLQ_SIZE_CAP}); event ${eventId} recorded as dropped`,
    };
  }

  const dlqResult = await enqueueDlqEntry(db as unknown as D1LikeClient, {
    eventId,
    paymentId: payment_id,
    paymentStatus: payment_status,
    orderId: ipn.order_id ?? '',
    payload: ipn as unknown as Record<string, unknown>,
    failureReason: err.message,
    retryCount: currentRetries,
  });

  if (dlqResult.ok) {
    logger.warn('[NOWPayments] IPN enqueued to DLQ', {
      event_id: eventId,
      reason: err.message,
    });
  } else {
    logger.error('[NOWPayments] Failed to enqueue DLQ entry', {
      event_id: eventId,
      error: String(dlqResult.error),
    });
  }

  return { success: false, message: `Permanent failure: ${err.message}` };
}
