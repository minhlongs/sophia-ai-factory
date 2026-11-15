import { getD1Raw } from '@/seed/db/client';
import { recordAudit } from '@/seed/db/audit/audit-log';
import { track } from '@/tree/signals/track';
import { D1Events } from '@/tree/signals/d1-event-types';
import { safelyRecordAffiliateCommission } from '@/tree/affiliates/affiliate-attribution';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';
import { resolvePayOsInitialMcuGrant } from './payos-subscription';
import { dispatchPayOsNotificationsAndTags } from './payos-fulfillment-notifications';
export { dispatchPayOsNotificationsAndTags } from './payos-fulfillment-notifications';

export interface PayOsFulfillmentParams {
  db: DbClient;
  userId: string;
  tier: Tier;
  order: PendingOrder;
  paymentLinkId: number | string;
  amount: number;
  orgId: string;
  periodEnd: string;
  isLifetime: boolean;
}

export async function processPayOsPostFulfillment(params: PayOsFulfillmentParams): Promise<void> {
  const { db, userId, tier, order, paymentLinkId, amount, orgId, periodEnd, isLifetime } = params;
  const orderId = order.order_id;

  // 0. Provision initial MCU credits idempotently via payment_reference
  try {
    const mcuGrant = resolvePayOsInitialMcuGrant(tier, order.period);
    if (mcuGrant > 0) {
      const rawDb = db.unwrap() as {
        prepare?: (sql: string) => { bind: (...args: unknown[]) => { run?: () => Promise<{ meta?: { changes?: number } }> } };
      };
      if (typeof rawDb?.prepare === 'function') {
        const nowSec = Math.floor(Date.now() / 1000);
        const paymentRef = `payos_${paymentLinkId}`;
        const txStmt = rawDb
          .prepare(
            `INSERT INTO mcu_transactions (user_id, delta, reason, metadata, payment_reference)
             VALUES (?1, ?2, 'PAYOS_SUBSCRIPTION_ACTIVATION', ?3, ?4)
             ON CONFLICT(payment_reference) DO NOTHING`,
          )
          .bind(
            userId,
            mcuGrant,
            JSON.stringify({ orderId, tier, period: order.period ?? 'monthly', amountVnd: amount }),
            paymentRef,
          );
        const txRes = typeof txStmt.run === 'function' ? await txStmt.run() : { meta: { changes: 0 } };
        if (txRes?.meta?.changes === 1) {
          const balStmt = rawDb
            .prepare(
              `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
               VALUES (?1, ?2, ?2, ?3)
               ON CONFLICT(user_id) DO UPDATE SET
                 credits_remaining = credits_remaining + excluded.credits_remaining,
                 credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
                 updated_at = excluded.updated_at`,
            )
            .bind(userId, mcuGrant, nowSec);
          if (typeof balStmt.run === 'function') {
            await balStmt.run();
          }
        }
      }
    }
  } catch (mcuErr) {
    logger.warn('[PayOS Webhook] Initial MCU provisioning skipped (non-fatal)', {
      paymentLinkId,
      userId,
      error: String(mcuErr),
    });
  }

  // 1. Non-blocking affiliate attribution (denominated strictly in USD cents, NEVER raw VND)
  try {
    const d1 = await getD1Raw();
    const usdAmountCents =
      typeof order.amount_usd_cents === 'number' && order.amount_usd_cents > 0
        ? Math.round(order.amount_usd_cents)
        : Math.round((amount / 25_000) * 100);
    await safelyRecordAffiliateCommission(
      {
        provider: 'payos',
        paymentId: String(paymentLinkId),
        orderId,
        customerId: userId,
        grossAmountCents: usdAmountCents,
        currency: 'USD',
      },
      d1
    );
  } catch (affErr) {
    logger.warn('[PayOS Webhook] Affiliate attribution failed (non-fatal)', {
      paymentLinkId,
      error: String(affErr),
    });
  }

  // 2. Audit trail
  try {
    const d1 = await getD1Raw();
    await recordAudit(d1, {
      tableName: 'subscriptions',
      rowId: orgId,
      action: 'update',
      actorId: userId,
      after: {
        tier,
        plan: tier.toLowerCase(),
        status: 'active',
        periodEnd,
        paymentId: `payos_${paymentLinkId}`,
        provider: 'payos',
        amountVnd: amount,
      },
    });
  } catch {
    /* non-fatal */
  }

  // 3. Telemetry
  track(
    D1Events.PAYMENT_SUCCESS,
    'webhook',
    {
      provider: 'payos',
      payment_link_id: paymentLinkId,
      amount_vnd: amount,
      tier,
    },
    userId
  );
  track(
    D1Events.TIER_CONVERSION,
    userId,
    {
      to_tier: tier,
      provider: 'payos',
      amount_vnd: amount,
    },
    userId
  );

  logger.info('[PayOS Webhook] Tier activated', { userId, tier, orgId, isLifetime, periodEnd });

  await dispatchPayOsNotificationsAndTags(params);
}
