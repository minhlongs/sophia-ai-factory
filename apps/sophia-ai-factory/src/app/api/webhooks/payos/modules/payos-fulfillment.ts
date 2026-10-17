import { getD1Raw } from '@/seed/db/client';
import { recordAudit } from '@/seed/db/audit/audit-log';
import { track } from '@/tree/signals/track';
import { D1Events } from '@/tree/signals/d1-event-types';
import { safelyRecordAffiliateCommission } from '@/tree/affiliates/affiliate-attribution';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';
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

  // 1. Non-blocking affiliate attribution
  try {
    const d1 = await getD1Raw();
    await safelyRecordAffiliateCommission(
      {
        provider: 'payos',
        paymentId: String(paymentLinkId),
        orderId,
        customerId: userId,
        grossAmountCents: amount,
        currency: 'VND',
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
