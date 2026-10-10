import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { recordAudit } from '@/seed/db/audit/audit-log';
import { markOrderCompleted } from '@/land/orders/pending-order-repo';
import { getPayOsTierConfig } from '@/land/payments/payos';
import type { Tier } from '@/seed/types';
import type { D1Client } from '@/seed/db/client';

export interface ActivateTierParams {
  db: D1Client;
  d1: D1Database;
  orderCode: string | number;
  paymentLinkId: string;
  amount: number;
  eventId: string;
}

export async function activatePayOsTier({
  db,
  d1,
  orderCode,
  paymentLinkId,
  amount,
  eventId,
}: ActivateTierParams): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: tierLookup, error: tierLookupError } = await db
    .from('pending_orders')
    .select('tier')
    .eq('payment_method', 'payos')
    .eq('status', 'pending')
    .limit(1);

  if (tierLookupError || !tierLookup || tierLookup.length === 0) {
    logger.error('[PayOS IPN] No pending orders for tier lookup', { tierLookupError });
    await db.from('payos_events').delete().eq('event_id', eventId);
    return { ok: false, error: 'No pending orders', status: 400 };
  }

  const tier = tierLookup[0].tier as Tier;
  const expectedVndAmount = getPayOsTierConfig(tier).vndAmount;
  if (amount !== expectedVndAmount) {
    logger.error('[PayOS IPN] Amount mismatch', {
      orderCode,
      received: amount,
      expected: expectedVndAmount,
      tier,
    });
    await db.from('payos_events').delete().eq('event_id', eventId);
    return { ok: false, error: 'Amount mismatch', status: 400 };
  }

  const { data: pendingOrders, error: pendingOrdersError } = await db
    .from('pending_orders')
    .select('*')
    .eq('payment_method', 'payos')
    .eq('status', 'pending');

  if (pendingOrdersError || !pendingOrders) {
    logger.error('[PayOS IPN] Failed to query pending_orders', { pendingOrdersError });
    await db.from('payos_events').delete().eq('event_id', eventId);
    return { ok: false, error: 'Database query failure', status: 500 };
  }

  const orders = pendingOrders as Array<{
    order_id: string;
    user_id: string;
    tier: string;
    invoice_url: string | null;
  }> | null;
  const matchOrder = orders?.find(
    (o) => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode))
  );

  if (!matchOrder) {
    logger.error('[PayOS IPN] No matching pending order found', { paymentLinkId, orderCode });
    await db.from('payos_events').delete().eq('event_id', eventId);
    return { ok: false, error: 'Order not found', status: 400 };
  }

  const userId = matchOrder.user_id;
  const orderId = matchOrder.order_id;
  const orderPeriod = (matchOrder as Record<string, unknown> | undefined)?.period as string | undefined;
  const now = new Date().toISOString();
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime';
  const billingPeriod = isLifetime ? 'lifetime' : orderPeriod === 'yearly' ? 'yearly' : 'monthly';
  const periodEnd =
    billingPeriod === 'lifetime'
      ? new Date('2099-12-31T23:59:59Z').toISOString()
      : billingPeriod === 'yearly'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const orgId = (await resolveOrgId(userId, db)) ?? undefined;

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

  const orderSubaccountId = (matchOrder as Record<string, unknown>)?.subaccount_id as string | undefined;
  if (orderSubaccountId) {
    try {
      await d1.prepare(`UPDATE client_subaccounts SET updated_at = datetime('now') WHERE id = ?1`).bind(orderSubaccountId).run().catch(() => {});
      logger.info('[PayOS IPN] Tagged client subaccount', { subaccountId: orderSubaccountId, orderId });
    } catch (subaccountErr) {
      logger.warn('[PayOS IPN] Subaccount tagging failed (non-fatal)', { error: String(subaccountErr) });
    }
  }

  await db.from('payos_events').update({ processed: 1, amount }).eq('event_id', eventId);
  logger.info('[PayOS IPN] Tier activated', { userId, orgId, tier, orderCode, amount });
  return { ok: true };
}
