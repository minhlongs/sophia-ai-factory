/**
 * NOWPayments IPN Verification and Refund Processing
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/ipn/ipn-signature-verifier
 */

import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import { recordAudit } from '@/seed/db/audit/audit-log';
import { markRefunded, getByPaymentId } from '@/seed/db/repositories/user-purchases-repo';
import { revokeAccessByPurchaseId } from '@/seed/db/repositories/videos-repo';
import { markUnderpaid, UNDERPAYMENT_THRESHOLD } from '../nowpayments-ipn-underpaid';
import { parseUserIdFromOrderId } from '../nowpayments-ipn-db';
import { success, failure, type Result } from '@/seed/types/result';
import { IPNError } from '../nowpayments-ipn-errors';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import type { NowPaymentsIpnPayload, OneTimeSku } from './types';

/**
 * Verify IPN price and underpayment guards.
 * Returns true if valid for fulfillment; returns false if dropped/underpaid.
 */
export async function verifyPaymentAmountAndUnderpayment(
  ipn: NowPaymentsIpnPayload,
  sku: OneTimeSku,
  userId: string,
): Promise<{ ok: boolean }> {
  // P0.4: Underpayment guard — reject if actually_paid < price_amount * 0.99
  // H8 fix: Cross-check IPN price_amount against SKU price
  const skuPriceUsd = sku.priceUsd ?? ipn.price_amount;
  const ipnPriceUsd = ipn.price_amount;
  const priceDiff = Math.abs(ipnPriceUsd - skuPriceUsd);
  if (skuPriceUsd > 0 && priceDiff > skuPriceUsd * 0.01) {
    logger.error('[IPN/OneTime] Price mismatch — IPN amount differs from SKU price', {
      userId,
      paymentId: ipn.payment_id,
      ipnPriceAmount: ipnPriceUsd,
      skuPriceUsd,
      priceDiff,
    });
    return { ok: false };
  }

  const actuallyPaid = ipn.actually_paid;
  if (actuallyPaid !== undefined && actuallyPaid !== null) {
    const required = ipn.price_amount * UNDERPAYMENT_THRESHOLD;
    if (actuallyPaid < required) {
      logger.warn('[IPN/OneTime] Underpayment detected — not fulfilling', {
        userId,
        paymentId: ipn.payment_id,
        priceAmount: ipn.price_amount,
        actuallyPaid,
        required,
      });
      await markUnderpaid(ipn.payment_id, userId, sku, actuallyPaid);
      return { ok: false };
    }
  }

  return { ok: true };
}

/**
 * Handle one-time IPN `refunded` event.
 * Marks row refunded, zeros credits, and revokes access to all linked videos.
 */
export async function handleOneTimeRefunded(
  ipn: NowPaymentsIpnPayload,
): Promise<Result<void, IPNError>> {
  try {
    const userId = parseUserIdFromOrderId(ipn.order_id ?? '');
    if (!userId) {
      logger.warn('[IPN/OneTime] refunded: cannot parse userId', { orderId: ipn.order_id });
      return success(undefined);
    }

    const existingPurchase = await getByPaymentId(ipn.payment_id);
    const purchaseId = existingPurchase?.id ?? null;

    await markRefunded(ipn.payment_id);

    if (purchaseId) {
      try {
        await revokeAccessByPurchaseId(purchaseId);
        logger.info('[IPN/OneTime] Video access revoked for refunded purchase', {
          userId,
          purchaseId,
          paymentId: ipn.payment_id,
        });
      } catch (revokeErr) {
        logger.error('[IPN/OneTime] Video access revocation failed', revokeErr instanceof Error ? revokeErr : undefined, {
          userId,
          purchaseId,
          paymentId: ipn.payment_id,
        });
        throw revokeErr;
      }
    }

    try {
      const db = await getD1();
      if (!db) throw new Error('D1 database binding not available');
      await recordAudit(db, {
        tableName: 'user_purchases',
        rowId: ipn.payment_id,
        action: 'update',
        actorId: userId,
        after: { status: 'refunded', credits_remaining: 0, paymentId: ipn.payment_id, accessRevoked: true },
      });
    } catch (auditErr) {
      logger.error('[IPN/OneTime] Refund audit failed (non-fatal)', auditErr instanceof Error ? auditErr : undefined, {
        userId,
        purchaseId,
        paymentId: ipn.payment_id,
      });
    }

    try {
      const db = await getD1();
      if (!db) throw new Error('D1 database binding not available');
      const nowSec = Math.floor(Date.now() / 1000);
      const subResult = await db
        .prepare('UPDATE subscriptions SET plan = ?, updated_at = ? WHERE user_id = ? AND plan != ?')
        .bind('basic', nowSec, userId, 'basic')
        .run();
      const orgId = await resolveOrgId(userId, db);
      if (orgId) {
        await db
          .prepare('UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ? AND plan != ?')
          .bind('basic', nowSec, orgId, 'basic')
          .run();
      }
      logger.info('[IPN/OneTime] Tier reverted to basic after refund', {
        userId,
        purchaseId,
        paymentId: ipn.payment_id,
        subscriptionRowsAffected: subResult.meta?.changes ?? 0,
      });
    } catch (tierErr) {
      logger.error('[IPN/OneTime] Tier revert failed (non-fatal)', tierErr instanceof Error ? tierErr : undefined, {
        userId,
        purchaseId,
        paymentId: ipn.payment_id,
      });
    }

    logger.info('[IPN/OneTime] Purchase refunded — credits zeroed, access revoked', {
      userId,
      purchaseId,
      paymentId: ipn.payment_id,
    });
    return success(undefined);
  } catch (err) {
    return failure(new IPNError('HANDLE_ONE_TIME_REFUNDED_FAILED', err));
  }
}
