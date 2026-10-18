/**
 * NOWPayments IPN main processor
 * @module land/billing/ipn-handlers/dispatcher
 */

import { logger } from '@/seed/utils/logger-utility';
import { writeDeadLetterToR2, generateDeadLetterKey } from '@/seed/r2/bucket-ops';
import { getDb } from '../nowpayments-ipn-db';
import {
  acquireIpnLock,
  acquireTerminalIpnLock,
  hasNowPaymentsRefundBarrier,
  markTerminalIpnProcessed,
  recordNowPaymentsRefundBarrier,
  releaseTerminalIpnLock,
} from './lock-manager';
import { handleIpnDlq } from './dlq-handler';
import { isPermanentFailure } from './error-classification';
import { dispatchPaymentStatus, mapNonAcquiredLockResponse } from './status-dispatcher';
import type { NowPaymentsIpnPayload } from './types';

export async function processNowPaymentsIpn(
  ipn: NowPaymentsIpnPayload,
): Promise<{ success: boolean; message: string }> {
  const { payment_id, payment_status } = ipn;
  const eventId = `nowpayments_${payment_id}_${payment_status}`;
  const db = getDb();

  if (!db) {
    await writeDeadLetterToR2(generateDeadLetterKey('nowpayments-ipn', eventId), {
      webhookType: 'nowpayments-ipn',
      operation: 'processNowPaymentsIpn',
      timestamp: new Date().toISOString(),
      payload: ipn,
      error: 'D1 binding unavailable at function entry',
    });
    logger.error('[NOWPayments IPN Handler] D1 binding unavailable — dead-letter written', { eventId, payment_id, payment_status });
    return { success: false, message: 'Database temporarily unavailable' };
  }

  const now = new Date().toISOString();
  const terminalStatus = payment_status === 'finished' || payment_status === 'refunded'
    ? payment_status
    : null;
  let terminalLockAcquired = false;
  if (terminalStatus) {
    const terminalLock = await acquireTerminalIpnLock(db, ipn, now);
    if (terminalLock.status !== 'acquired') {
      return mapNonAcquiredLockResponse(terminalLock.status);
    }
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
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[NOWPayments] Terminal payment guard failed', err, { payment_id, payment_status });
      return { success: false, message: 'Terminal payment guard failed' };
    }
  }

  const lock = await acquireIpnLock(db, eventId, ipn, now);
  if (lock.status !== 'acquired') {
    if (terminalLockAcquired && terminalStatus) {
      if (lock.status === 'already_processed') await markTerminalIpnProcessed(db, ipn, terminalStatus);
      else await releaseTerminalIpnLock(db, payment_id);
    }
    return mapNonAcquiredLockResponse(lock.status);
  }

  try {
    await dispatchPaymentStatus(db, ipn);
    await db
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run();
    if (terminalLockAcquired && terminalStatus) await markTerminalIpnProcessed(db, ipn, terminalStatus);
    return { success: true, message: `Processed ${payment_status}` };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[NOWPayments] IPN processing failed', err, { payment_id, payment_status });

    if (isPermanentFailure(err)) {
      if (terminalLockAcquired) await releaseTerminalIpnLock(db, payment_id);
      return handleIpnDlq(db, eventId, ipn, err);
    }

    try {
      await db.prepare('DELETE FROM payment_events WHERE event_id = ?1').bind(eventId).run();
    } catch (delErr) {
      logger.warn('[NOWPayments] Failed to release lock on failure', { payment_id, error: String(delErr) });
    }

    if (terminalLockAcquired) {
      try {
        await releaseTerminalIpnLock(db, payment_id);
      } catch (releaseErr) {
        logger.warn('[NOWPayments] Failed to release terminal lock on failure', { payment_id, error: String(releaseErr) });
      }
    }

    return { success: false, message: err.message };
  }
}
