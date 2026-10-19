/**
 * NOWPayments IPN status dispatcher and lock response mapper
 * @module land/billing/ipn-handlers/status-dispatcher
 */

import type { D1Client } from '@/seed/db/d1-client-rpc';
import { logger } from '@/seed/utils/logger-utility';
import { safeCatch } from '@/seed/utils/safe-catch';
import { handleFailed } from '../nowpayments-ipn-subscription';
import { dispatchFinished, dispatchRefunded } from '../nowpayments-ipn-dispatch';
import type { IpnLockResult } from './lock-manager';
import type { NowPaymentsIpnPayload } from './types';

export function mapNonAcquiredLockResponse(
  status: Exclude<IpnLockResult['status'], 'acquired'>,
): { success: boolean; message: string } {
  if (status === 'already_processed') return { success: true, message: 'Already processed' };
  if (status === 'db_failure') return { success: false, message: 'Database query failure' };
  if (status === 'stale_recovered_retry') return { success: false, message: 'Stale lock recovered — retry' };
  if (status === 'stale_recovery_in_progress') return { success: false, message: 'Stale lock recovery in progress' };
  return { success: false, message: 'Already processing' };
}

export async function dispatchPaymentStatus(
  db: D1Client,
  ipn: NowPaymentsIpnPayload,
): Promise<boolean> {
  const { payment_id, payment_status, order_id } = ipn;
  switch (payment_status) {
    case 'finished':
      return dispatchFinished(ipn, db);
    case 'refunded':
      await dispatchRefunded(ipn, db);
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
        await db.from('pending_orders').update({ status: 'expired' })
          .eq('order_id', order_id).eq('status', 'pending');
      } catch (e) { safeCatch('Expired order mark')(e); }
      logger.info('[NOWPayments] Payment expired', { payment_id, order_id });
      logger.info('[NOWPayments] Payment expired — marked pending_orders expired', { payment_id, order_id });
      break;
    default:
      logger.debug('[NOWPayments] Unhandled status', { payment_status, payment_id });
  }
  return true;
}
