import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { recordAudit } from '@/seed/db/audit/audit-log';
import { markOrderCompleted } from '@/land/orders/pending-order-repo';
import type { Tier } from '@/seed/types';
import type { D1Client } from '@/seed/db/client';

export interface PayOsPostActivationParams {
  db: D1Client;
  d1: D1Database;
  userId: string;
  orgId: string | undefined;
  tier: Tier;
  billingPeriod: 'lifetime' | 'yearly' | 'monthly';
  periodEnd: string;
  orderCode: string | number;
  orderId: string;
  amount: number;
  subaccountId: string | undefined;
}

export async function commitPayOsSubscriptionBatch(params: {
  db: D1Client;
  d1: D1Database;
  orgId: string | undefined;
  tier: Tier;
  periodEnd: string;
  now: string;
  orderCode: string | number;
  orderId: string;
}): Promise<void> {
  const { db, d1, orgId, tier, periodEnd, now, orderCode, orderId } = params;
  try {
    const { data: existingSub } = await db.from('subscriptions').select('id').eq('org_id', orgId ?? '').single();
    const stmts = orgId
      ? existingSub
        ? [
            d1.prepare('UPDATE subscriptions SET plan=?, status=?, current_period_end=?, updated_at=? WHERE org_id=?')
              .bind(tier.toLowerCase(), 'active', periodEnd, now, orgId),
            d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
              .bind(tier.toLowerCase(), now, orgId),
            d1.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?')
              .bind('completed', `payos_${orderCode}`, now, orderId),
          ]
        : [
            d1.prepare('INSERT INTO subscriptions (org_id, plan, status, current_period_start, current_period_end) VALUES (?,?,?,?,?)')
              .bind(orgId, tier.toLowerCase(), 'active', now, periodEnd),
            d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
              .bind(tier.toLowerCase(), now, orgId),
            d1.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?')
              .bind('completed', `payos_${orderCode}`, now, orderId),
          ]
      : [];

    if (stmts.length > 0) await d1.batch(stmts);
  } catch (batchErr) {
    logger.warn('[PayOS IPN] Batch failed, verifying state before fallback', { error: String(batchErr) });
    if (orgId) {
      await db.from('subscriptions').update({ plan: tier.toLowerCase(), status: 'active', current_period_end: periodEnd, updated_at: now }).eq('org_id', orgId);
      await db.from('organizations').update({ plan: tier.toLowerCase(), updated_at: now }).eq('id', orgId);
    }
    await markOrderCompleted(orderId, `payos_${orderCode}`);
    throw batchErr;
  }
}

export async function runPayOsPostActivationEffects({
  db,
  d1,
  userId,
  orgId,
  tier,
  billingPeriod,
  periodEnd,
  orderCode,
  orderId,
  amount,
  subaccountId,
}: PayOsPostActivationParams): Promise<void> {
  try {
    await recordAudit(d1, {
      tableName: 'subscriptions',
      rowId: orgId ?? userId,
      action: 'update',
      actorId: userId,
      after: { tier, plan: tier.toLowerCase(), status: 'active', periodEnd, paymentId: `payos_${orderCode}`, provider: 'payos', amountVnd: amount },
    });
  } catch { /* non-fatal */ }

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
        period: billingPeriod,
        amountUsd: Math.round(amount / 25000),
        paymentId: `payos_${orderCode}`,
        paymentMethod: 'payos',
        orderId,
        locale: 'vi',
      });
    }
  } catch (receiptErr) {
    logger.warn('[PayOS IPN] Receipt email failed (non-fatal)', { error: String(receiptErr) });
  }

  if (subaccountId) {
    try {
      await d1.prepare(`UPDATE client_subaccounts SET updated_at = datetime('now') WHERE id = ?1`).bind(subaccountId).run().catch(() => {});
      logger.info('[PayOS IPN] Tagged client subaccount', { subaccountId, orderId });
    } catch (subaccountErr) {
      logger.warn('[PayOS IPN] Subaccount tagging failed (non-fatal)', { error: String(subaccountErr) });
    }
  }
}
