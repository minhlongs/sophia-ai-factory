/**
 * NOWPayments underpayment handler.
 * Extracted from nowpayments-ipn-one-time.ts for file size compliance.
 *
 * Records a purchase row with status='underpaid' and no fulfillment.
 * Customer receives no credits; support team must manually review.
 *
 * @module billing/nowpayments-ipn-underpaid
 */

import { logger } from '@/seed/utils/logger-utility'
import { getD1 } from '@/seed/db/client'
import { recordAudit } from '@/seed/db/audit/audit-log'
import type { OneTimeSku } from '@/seed/types'
import { success, failure, type Result } from '@/seed/types/result'
import { IPNError } from './nowpayments-ipn-errors'

/** 1% tolerance for crypto gas fees / exchange rounding. */
export const UNDERPAYMENT_THRESHOLD = 0.99

/**
 * Mark a purchase as underpaid without fulfilling.
 * Inserts a row with status='underpaid' so IPN idempotency still works.
 * Any error is logged but swallowed — caller already logged the underpayment.
 */
export async function markUnderpaid(
  paymentId: string,
  userId: string,
  sku: OneTimeSku,
  actuallyPaid: number,
): Promise<Result<void, IPNError>> {
  try {
    const _d1 = await getD1();
    if (!_d1) return failure(new IPNError('D1_BINDING_UNAVAILABLE'));
    const d1 = _d1;
    const amountCents = Math.round(actuallyPaid * 100)
    const now = Math.floor(Date.now() / 1000)

    await d1
      .prepare(
        `INSERT INTO user_purchases
           (user_id, kind, sku, payment_id, amount_cents, credits_total, credits_remaining, status, created_at, updated_at)
         VALUES (?1, 'one_time', ?2, ?3, ?4, 0, 0, 'underpaid', ?5, ?5)
         ON CONFLICT(payment_id) DO UPDATE SET
           status     = 'underpaid',
           updated_at = ?5`,
      )
      .bind(userId, sku.id, paymentId, amountCents, now)
      .run()

    await recordAudit(d1, {
      tableName: 'user_purchases',
      rowId: paymentId,
      action: 'update',
      actorId: userId,
      after: {
        status: 'underpaid',
        sku: sku.id,
        actuallyPaid,
        expectedMin: sku.priceUsd * UNDERPAYMENT_THRESHOLD,
        paymentId,
      },
    })

    logger.info('[IPN/OneTime] Underpaid purchase recorded — manual review required', {
      userId,
      paymentId,
      actuallyPaid,
      skuId: sku.id,
    })
    return success(undefined)
  } catch (err) {
    return failure(new IPNError('MARK_UNDERPAID_FAILED', err))
  }
}
