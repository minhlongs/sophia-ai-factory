/**
 * NOWPayments IPN main processor
 * @module land/billing/ipn-handlers/dispatcher
 */

import type { D1Client } from '@/seed/db/d1-client-rpc';
import { logger } from '@/seed/utils/logger-utility';
import { safeCatch } from '@/seed/utils/safe-catch';
import { writeDeadLetterToR2, generateDeadLetterKey } from '@/seed/r2/bucket-ops';
import { getDb } from '../nowpayments-ipn-db';
import { handleFailed } from '../nowpayments-ipn-subscription';
import { dispatchFinished, dispatchRefunded } from '../nowpayments-ipn-dispatch';
import { acquireIpnLock } from './lock-manager';
import { handleIpnDlq } from './dlq-handler';
import { isPermanentFailure } from './error-classification';
import type { NowPaymentsIpnPayload } from './types';

async function dispatchPaymentStatus(db: D1Client, ipn: NowPaymentsIpnPayload): Promise<void> {
  const { payment_id, payment_status, order_id } = ipn;
  switch (payment_status) {
    case 'finished':
      await dispatchFinished(ipn);
      break;
    case 'refunded':
      await dispatchRefunded(ipn);
      break;
    case 'failed': {
      const failResult = await handleFailed(ipn);
      if (!failResult.ok) throw failResult.error;
      break;
    }
    case 'partially_paid':
      logger.info('[NOWPayments] Partial payment received — holding', { payment_id });
      break;
    case 'waiting':
    case 'confirming':
    case 'confirmed':
    case 'sending':
      logger.debug('[NOWPayments] Intermediate status, waiting for final', {
        payment_status, payment_id, order_id,
      });
      break;
    case 'expired':
      try {
        await db.from('pending_orders').update({ status: 'expired' }).eq('order_id', order_id);
      } catch (e) { safeCatch('Expired order mark')(e); }
      logger.info('[NOWPayments] Payment expired', { payment_id, order_id });
      logger.info('[NOWPayments] Payment expired — marked pending_orders expired', { payment_id, order_id });
      break;
    default:
      logger.debug('[NOWPayments] Unhandled status', { payment_status, payment_id });
  }
}

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
  const lock = await acquireIpnLock(db, eventId, ipn, now);
  if (lock.status === 'db_failure') return { success: false, message: 'Database query failure' };
  if (lock.status === 'already_processed') return { success: true, message: 'Already processed' };
  if (lock.status === 'stale_recovered_retry') return { success: false, message: 'Stale lock recovered — retry' };
  if (lock.status === 'stale_recovery_in_progress') return { success: false, message: 'Stale lock recovery in progress' };
  if (lock.status === 'already_processing') return { success: false, message: 'Already processing' };

  try {
    await dispatchPaymentStatus(db, ipn);
    await db
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run();
    return { success: true, message: `Processed ${payment_status}` };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[NOWPayments] IPN processing failed', err, { payment_id, payment_status });

    if (isPermanentFailure(err)) {
      return handleIpnDlq(db, eventId, ipn, err);
    }

    try {
      await db.prepare('DELETE FROM payment_events WHERE event_id = ?1').bind(eventId).run();
    } catch (delErr) {
      logger.warn('[NOWPayments] Failed to release lock on failure', { payment_id, error: String(delErr) });
    }

    return { success: false, message: err.message };
  }
}
