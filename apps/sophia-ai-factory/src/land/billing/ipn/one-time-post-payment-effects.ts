/**
 * NOWPayments IPN One-Time Post-Payment Side Effects
 *
 * Non-fatal post-payment operations: pending_orders update, audit trail,
 * auto-handover trigger, and one-time fulfillment trigger.
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/ipn/one-time-post-payment-effects
 */

import { logger } from '@/seed/utils/logger-utility';
import { safeCatch } from '@/seed/utils/safe-catch';
import { getD1 } from '@/seed/db/client';
import { recordAudit } from '@/seed/db/audit/audit-log';
import { triggerOneTimeFulfillment } from '@/land/fulfillment/one-time-fulfillment';
import { getDb } from '../nowpayments-ipn-db';
import { triggerAutoHandover } from '@/tree/handover/auto-handover';
import type { NowPaymentsIpnPayload, OneTimeSku } from './types';

export async function runOneTimePostPaymentEffects(
  ipn: NowPaymentsIpnPayload,
  sku: OneTimeSku,
  userId: string,
  purchaseId: string,
  expiresAt: number,
): Promise<void> {
  // Update pending_orders to completed
  try {
    const db = await getD1();
    if (db) {
      await db
        .prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?')
        .bind('completed', ipn.payment_id, Math.floor(Date.now() / 1000), ipn.order_id);
    }
  } catch (e) {
    safeCatch('One-time pending_orders mark complete')(e);
  }

  // Audit trail
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await recordAudit(db, {
      tableName: 'user_purchases',
      rowId: purchaseId,
      action: 'update',
      actorId: userId,
      after: {
        status: 'paid',
        sku: sku.id,
        credits: sku.credits,
        expiresAt,
        paymentId: ipn.payment_id,
      },
    });
  } catch (auditErr) {
    logger.error('[IPN/OneTime] Audit record failed (non-fatal)', auditErr instanceof Error ? auditErr : undefined, {
      userId,
      purchaseId,
    });
  }

  logger.info('[IPN/OneTime] Purchase paid', {
    userId,
    purchaseId,
    skuId: sku.id,
    credits: sku.credits,
    paymentId: ipn.payment_id,
  });

  // Auto-handover for one-time bundle buyers — non-fatal
  try {
    const db = getDb();
    const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single();
    const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? ipn.customer_email ?? '';
    const userName = (userRow as { email?: string; name?: string } | null)?.name ?? undefined;
    if (userEmail) {
      await triggerAutoHandover({
        paymentId: ipn.payment_id,
        userId,
        email: userEmail,
        fullName: userName,
        tier: 'BASIC',
        isFirstPurchase: true,
      });
    }
  } catch (err) {
    logger.warn('[IPN/OneTime] Auto-handover failed (non-fatal)', { userId, error: String(err) });
  }

  // Trigger fulfillment (video gen + email) — non-fatal
  try {
    await triggerOneTimeFulfillment(userId, purchaseId, sku);
  } catch (err) {
    logger.error('[IPN/OneTime] Fulfillment trigger failed (non-fatal)', err instanceof Error ? err : undefined, {
      userId,
      purchaseId,
    });
  }
}
