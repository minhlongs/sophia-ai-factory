import type { PendingOrder } from '@/land/orders/pending-order-types';
/** Atomic order claim and entitlement writes for the legacy PayOS IPN. */
import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { invalidateUserTierCache } from '@/seed/db/get-user-tier';
import {
  resolveEffectiveSubscriptionState,
  resolvePayOsInitialMcuGrant,
} from '@/app/api/webhooks/payos/modules/payos-subscription';
import type { Tier } from '@/seed/types';
import type { D1Client } from '@/seed/db/client';

export async function commitPayOsSubscriptionBatch(params: {
  db: D1Client;
  d1: D1Database;
  userId?: string;
  orgId: string | undefined;
  tier: Tier;
  billingPeriod?: 'lifetime' | 'yearly' | 'monthly' | 'pilot_14d';
  periodEnd: string;
  now: string;
  orderCode: string | number;
  orderId: string;
  amount: number;
  eventId: string;
  lockCreatedAt: string;
  order: PendingOrder;
}): Promise<void> {
  const { d1, userId, orgId, tier, billingPeriod, now, orderCode, orderId, amount, eventId, lockCreatedAt, order } = params;
  if (order.period === 'pilot_14d' || billingPeriod === 'pilot_14d') {
    throw new Error('Pilot payment requires manual review / Thanh toán Pilot cần được kiểm tra thủ công');
  }
  if (!userId || !orgId) throw new Error('PayOS activation requires a buyer organization');
  const nowMs = Number.isFinite(Date.parse(now)) ? Date.parse(now) : Date.now();
  try {
    const existing = await d1.prepare(`SELECT COUNT(*) AS count, MIN(id) AS id,
      MIN(tier) AS tier, MIN(plan) AS plan, MIN(status) AS status,
      MIN(current_period_start) AS current_period_start, MIN(current_period_end) AS current_period_end
      FROM subscriptions WHERE org_id=?`).bind(orgId).first<{
        count: number; id: string | null; tier: string | null; plan: string | null;
        status: string | null; current_period_start: string | null; current_period_end: string | null;
      }>();
    if (!existing || existing.count > 1) throw new Error('Ambiguous PayOS subscription state');
    const effective = resolveEffectiveSubscriptionState({
      purchasedTier: tier, orderPeriod: billingPeriod, nowMs, existing: existing.count ? existing : null,
    });
    // Claim the shared order before any grant. Every subsequent write is gated by
    // the previous statement's row count, within the same atomic D1 batch.
    // Compare the full subscription snapshot so a concurrent renewal/upgrade wins safely.
    const stmts = [d1.prepare(`UPDATE pending_orders SET status='completed', payment_id=?, completed_at=?
      WHERE order_id=? AND status='pending' AND payment_method='payos' AND period <> 'pilot_14d'
      AND user_id=? AND tier=? AND period=? AND amount_vnd IS ?
       AND provider_payment_id IS ? AND provider_order_code IS ? AND invoice_url IS ?
       AND purpose IS ? AND amount_usd_cents IS ?
       AND EXISTS (SELECT 1 FROM payos_events WHERE event_id=? AND created_at=? AND processed=0)
      AND EXISTS (SELECT 1 FROM organizations WHERE id=?)
      AND EXISTS (SELECT 1 FROM org_members WHERE org_id=? AND user_id=?)
      AND (SELECT COUNT(*) FROM subscriptions WHERE org_id=?)=?
      AND (?=0 OR EXISTS (SELECT 1 FROM subscriptions WHERE org_id=? AND id IS ?
        AND tier IS ? AND plan IS ? AND status IS ?
        AND current_period_start IS ? AND current_period_end IS ?))`)
      .bind(`payos_${orderCode}`, now, orderId, userId, tier, billingPeriod ?? 'monthly', order.amount_vnd ?? null,
        order.provider_payment_id ?? null, order.provider_order_code ?? null, order.invoice_url ?? null,
        order.purpose ?? null, order.amount_usd_cents, eventId, lockCreatedAt,
        orgId, orgId, userId, orgId, existing.count, existing.count, orgId, existing.id,
        existing.tier, existing.plan, existing.status, existing.current_period_start, existing.current_period_end)];
    stmts.push(existing.count
      ? d1.prepare(`UPDATE subscriptions SET tier=?, plan=?, status='active', current_period_start=?,
          current_period_end=?, updated_at=? WHERE org_id=? AND id=? AND changes()=1`)
          .bind(effective.effectiveTier, effective.effectivePlan, effective.periodStart, effective.periodEnd, now, orgId, existing.id)
      : d1.prepare(`INSERT INTO subscriptions (org_id, user_id, tier, plan, status, current_period_start, current_period_end)
          SELECT ?, ?, ?, ?, 'active', ?, ? WHERE changes()=1`)
          .bind(orgId, userId, effective.effectiveTier, effective.effectivePlan, effective.periodStart, effective.periodEnd));
    stmts.push(d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=? AND changes()=1')
      .bind(effective.effectivePlan, now, orgId));
    const mcuGrant = resolvePayOsInitialMcuGrant(tier, billingPeriod);
    if (mcuGrant > 0) {
      // Preparing either credit statement must fail the entire activation closed.
      stmts.push(
        d1.prepare(`INSERT INTO mcu_transactions (user_id, delta, reason, metadata, payment_reference)
          SELECT ?, ?, 'PAYOS_SUBSCRIPTION_ACTIVATION', ?, ? WHERE changes()=1
          ON CONFLICT(payment_reference) WHERE payment_reference IS NOT NULL DO NOTHING`)
          .bind(userId, mcuGrant, JSON.stringify({ orderId, tier, period: billingPeriod ?? 'monthly' }), `payos_order_${orderId}`),
        d1.prepare(`INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
          SELECT ?1, ?2, ?2, ?3 WHERE changes()=1
          ON CONFLICT(user_id) DO UPDATE SET
            credits_remaining=credits_remaining+excluded.credits_remaining,
            credits_total_purchased=credits_total_purchased+excluded.credits_total_purchased,
            updated_at=excluded.updated_at`)
          .bind(userId, mcuGrant, Math.floor(nowMs / 1000)),
      );
    }
    stmts.push(d1.prepare(`UPDATE payos_events SET processed=1 WHERE event_id=? AND created_at=? AND processed=0
      AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id=? AND status='completed' AND payment_id=?)`)
      .bind(eventId, lockCreatedAt, orderId, `payos_${orderCode}`));
    const results = await d1.batch(stmts);
    if (results.length !== stmts.length || results.some((r, index) =>
      !r.success || r.error || (index < 3 ? r.meta?.changes !== 1 : ![0, 1].includes(r.meta?.changes)))) {
      throw new Error('PayOS order claim or entitlement write failed');
    }
    invalidateUserTierCache(userId);
  } catch (batchErr) {
    logger.error('[PayOS IPN] Atomic batch failed; aborting without partial writes for clean retry', batchErr instanceof Error ? batchErr : new Error(String(batchErr)), { orderId, orderCode });
    throw batchErr;
  }
}
