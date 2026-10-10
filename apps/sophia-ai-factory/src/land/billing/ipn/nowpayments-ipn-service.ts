/**
 * NOWPayments IPN Finished Event Processor for One-Time Bundles
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/ipn/nowpayments-ipn-service
 */

import { logger } from '@/seed/utils/logger-utility';
import { safeCatch } from '@/seed/utils/safe-catch';
import { getD1 } from '@/seed/db/client';
import { recordAudit } from '@/seed/db/audit/audit-log';
import { insertPurchase, markPaid } from '@/seed/db/repositories/user-purchases-repo';
import { triggerOneTimeFulfillment } from '@/land/fulfillment/one-time-fulfillment';
import { parseUserIdFromOrderId, getDb } from '../nowpayments-ipn-db';
import { triggerAutoHandover } from '@/tree/handover/auto-handover';
import { success, failure, type Result } from '@/seed/types/result';
import { IPNError } from '../nowpayments-ipn-errors';
import type { NowPaymentsIpnPayload, OneTimeSku } from './types';
import { addMonths } from './types';
import { verifyPaymentAmountAndUnderpayment } from './ipn-signature-verifier';

/**
 * Handle one-time IPN `finished` event.
 * Inserts user_purchases row (idempotent), marks paid, triggers fulfillment.
 * Rejects underpayments — sets status='underpaid', skips fulfillment.
 */
export async function handleOneTimeFinished(
  ipn: NowPaymentsIpnPayload,
  sku: OneTimeSku,
): Promise<Result<void, IPNError>> {
  try {
    const userId = parseUserIdFromOrderId(ipn.order_id ?? '');
    if (!userId) {
      logger.warn('[IPN/OneTime] finished: cannot parse userId', { orderId: ipn.order_id, paymentId: ipn.payment_id });
      return success(undefined);
    }

    const verification = await verifyPaymentAmountAndUnderpayment(ipn, sku, userId);
    if (!verification.ok) {
      return success(undefined);
    }

    const expiresAt = Math.floor(addMonths(new Date(), sku.ttlMonths).getTime() / 1000);
    const amountCents = Math.round(ipn.price_amount * 100);

    // Insert purchase row (idempotent — returns existing id if conflict)
    const purchaseId = await insertPurchase({
      userId,
      kind: 'one_time',
      sku: sku.id,
      paymentId: ipn.payment_id,
      invoiceId: ipn.invoice_id ?? null,
      amountCents,
      creditsTotal: sku.credits,
      expiresAt,
      status: 'pending',
    });

    if (!purchaseId) {
      logger.error('[IPN/OneTime] finished: failed to insert purchase row', undefined, {
        paymentId: ipn.payment_id,
        userId,
      });
      return failure(new IPNError('INSERT_PURCHASE_FAILED', new Error('Failed to insert purchase row')));
    }

    // Mark paid + set credits_remaining
    await markPaid(ipn.payment_id, sku.credits, expiresAt);

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

    return success(undefined);
  } catch (err) {
    return failure(new IPNError('HANDLE_ONE_TIME_FINISHED_FAILED', err));
  }
}
