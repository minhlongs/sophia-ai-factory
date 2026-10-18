/**
 * Overage Top-Up Service
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/topup/overage-topup-service
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  type TopupIpnPayload,
  type ProcessTopupResult,
} from './types';
import { acquireTopupEventLock } from './overage-topup-helpers';
import { executeLockedTopupFulfillment } from './overage-topup-fulfillment';
import {
  acquireTerminalIpnLock,
  hasNowPaymentsRefundBarrier,
  markTerminalIpnProcessed,
  recordNowPaymentsRefundBarrier,
  releaseTerminalIpnLock,
} from '../ipn-handlers/terminal-lock-manager';
import { mapNonAcquiredLockResponse } from '../ipn-handlers/status-dispatcher';

/**
 * Process a top-up IPN (Instant Payment Notification).
 *
 * Atomic lock via INSERT ON CONFLICT DO NOTHING on payment_events table.
 * Verifies payment amount, grants credits, marks overage events billable,
 * and invalidates quota cache.
 */
export async function processTopupIpn(
  ipn: TopupIpnPayload,
): Promise<ProcessTopupResult> {
  const { payment_id, payment_status, order_id } = ipn;

  if (!order_id.startsWith('topup_')) {
    return { success: false, message: 'Not a top-up order' };
  }

  const eventId = `topup_${payment_id}_${payment_status}`;
  const db = createServerClient();
  const now = new Date().toISOString();
  const terminalStatus = payment_status === 'finished' || payment_status === 'refunded'
    ? payment_status
    : null;
  let terminalLockAcquired = false;

  if (terminalStatus) {
    const terminalLock = await acquireTerminalIpnLock(db, ipn, now);
    if (terminalLock.status !== 'acquired') return mapNonAcquiredLockResponse(terminalLock.status);
    terminalLockAcquired = true;
    try {
      if (payment_status === 'refunded') {
        await recordNowPaymentsRefundBarrier(db, payment_id);
      } else if (await hasNowPaymentsRefundBarrier(db, payment_id)) {
        await markTerminalIpnProcessed(db, ipn, 'refunded');
        return { success: true, message: 'Ignored finished event after refund' };
      }
    } catch (error) {
      await releaseTerminalIpnLock(db, payment_id);
      return { success: false, message: error instanceof Error ? error.message : 'Terminal payment guard failed' };
    }
  }

  let lockOutcome: Awaited<ReturnType<typeof acquireTopupEventLock>>;
  try {
    lockOutcome = await acquireTopupEventLock(db, eventId, ipn, now);
  } catch (error) {
    if (terminalLockAcquired) await releaseTerminalIpnLock(db, payment_id);
    return { success: false, message: error instanceof Error ? error.message : 'Database query failure' };
  }
  if (!lockOutcome.acquired) {
    if (terminalLockAcquired) {
      if (lockOutcome.response.message === 'Already processed' && terminalStatus) {
        await markTerminalIpnProcessed(db, ipn, terminalStatus);
      } else {
        await releaseTerminalIpnLock(db, payment_id);
      }
    }
    return lockOutcome.response;
  }

  try {
    return await executeLockedTopupFulfillment(db, ipn, eventId, terminalStatus);
  } catch (error) {
    logger.error('[OverageTopup] Processing failed', toError(error));
    try {
      await db.prepare('DELETE FROM payment_events WHERE event_id = ?1').bind(eventId).run();
    } catch {
      // Non-fatal — lock release best-effort
    }
    if (terminalLockAcquired) {
      try {
        await releaseTerminalIpnLock(db, payment_id);
      } catch {
        // Terminal lock release is best-effort; the refund barrier remains durable.
      }
    }
    return { success: false, message: error instanceof Error ? error.message : 'Processing failed' };
  }
}
