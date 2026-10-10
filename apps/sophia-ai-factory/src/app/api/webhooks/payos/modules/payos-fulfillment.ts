import { getD1Raw } from '@/seed/db/client';
import { recordAudit } from '@/seed/db/audit/audit-log';
import { track } from '@/tree/signals/track';
import { D1Events } from '@/tree/signals/d1-event-types';
import { safelyRecordAffiliateCommission } from '@/tree/affiliates/affiliate-attribution';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

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

  // 4. Dual-rail instant reconciliation: send receipt email via Resend
  try {
    const { sendReceiptEmail } = await import('@/land/billing/email/receipt-email-sender');
    const { data: userRow } = await db.from('user').select('name,email').eq('id', userId).maybeSingle();
    const userEmail = (userRow as { name?: string; email?: string } | null)?.email;
    const userName = (userRow as { name?: string; email?: string } | null)?.name;

    if (userEmail) {
      await sendReceiptEmail({
        email: userEmail,
        userName: userName ?? undefined,
        tier,
        period: isLifetime ? 'lifetime' : order.period === 'yearly' ? 'yearly' : 'monthly',
        amountUsd: Math.round(amount / 25000),
        paymentId: `payos_${paymentLinkId}`,
        paymentMethod: 'payos',
        orderId,
        locale: 'vi',
      });
    }
  } catch (receiptErr) {
    logger.warn('[PayOS Webhook] Receipt email failed (non-fatal)', { error: String(receiptErr) });
  }

  // 5. Tag client subaccount if payment originated from a subaccount
  const orderSubaccountId = (order as unknown as Record<string, unknown>)?.subaccount_id as string | undefined;
  if (orderSubaccountId) {
    try {
      const d1 = await getD1Raw().catch(() => null);
      if (d1) {
        await d1
          .prepare(`UPDATE client_subaccounts SET updated_at = datetime('now') WHERE id = ?1`)
          .bind(orderSubaccountId)
          .run()
          .catch(() => {});
      }
      logger.info('[PayOS Webhook] Tagged client subaccount', { subaccountId: orderSubaccountId, orderId });
    } catch (subaccountErr) {
      logger.warn('[PayOS Webhook] Subaccount tagging failed (non-fatal)', { error: String(subaccountErr) });
    }
  }

  // 6. Wire Telegram Admin / Founder notification
  try {
    const { notifyFounderPaymentSuccess } = await import('@/tree/telegram/telegram-admin-notifier');
    const { data: userRow } = await db.from('user').select('name,email').eq('id', userId).maybeSingle();
    const userName = (userRow as { name?: string; email?: string } | null)?.name ?? `User ${userId}`;
    const userEmail = (userRow as { name?: string; email?: string } | null)?.email;

    const d1 = await getD1Raw().catch(() => null);
    let paidCount = 1;
    if (d1) {
      const countRes = await d1
        .prepare(`SELECT COUNT(*) as cnt FROM payment_events WHERE event_type = 'payos.payment_success' AND processed = 1`)
        .first<{ cnt: number }>()
        .catch(() => null);
      paidCount = countRes?.cnt ?? 1;
    }

    await notifyFounderPaymentSuccess({
      customerName: userName,
      email: userEmail,
      tier,
      amountUsd: Math.round(amount / 25000),
      amountVnd: amount,
      provider: 'payos',
      promoCode: order.promo_code ?? undefined,
      paymentId: `payos_${paymentLinkId}`,
      orderId,
      customerIndex: paidCount,
    });

    if (orderId.includes('sophia_tg_')) {
      const { markLeadPaid } = await import('@/land/telegram-sales/telegram-lead-repo');
      const match = orderId.match(/sophia_tg_([^_]+)_/);
      if (match) {
        await markLeadPaid(match[1], orderId).catch(() => {});
      }
    }
  } catch (notifyErr) {
    logger.warn('[PayOS Webhook] Founder notification failed (non-fatal)', { error: String(notifyErr) });
  }
}
