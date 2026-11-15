/**
 * PayOS subscription batch commit operations.
 * Layer: app/api/payos/ipn/modules
 * @module app/api/payos/ipn/modules/payroll-subscription
 */

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
}): Promise<void> {
  const { db, d1, userId, orgId, tier, billingPeriod, periodEnd, now, orderCode, orderId } = params;
  const nowMs = Number.isFinite(Date.parse(now)) ? Date.parse(now) : Date.now();
  try {
    const { data: existingSub } = await db
      .from('subscriptions')
      .select('id,plan,tier,status,current_period_end')
      .eq('org_id', orgId ?? '')
      .single();
    const existingTyped = existingSub as {
      id?: string;
      plan?: string | null;
      tier?: string | null;
      status?: string | null;
      current_period_end?: string | null;
    } | null;

    const effective = existingTyped
      ? resolveEffectiveSubscriptionState({
          purchasedTier: tier,
          orderPeriod: billingPeriod,
          nowMs,
          existing: existingTyped,
        })
      : { effectiveTier: tier, effectivePlan: tier.toLowerCase(), periodEnd };

    const stmts = orgId
      ? existingTyped
        ? [
            d1.prepare('UPDATE subscriptions SET tier=?, plan=?, status=?, current_period_end=?, updated_at=? WHERE org_id=?')
              .bind(effective.effectiveTier, effective.effectivePlan, 'active', effective.periodEnd, now, orgId),
            d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
              .bind(effective.effectivePlan, now, orgId),
            d1.prepare("UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=? AND status='pending'")
              .bind('completed', `payos_${orderCode}`, now, orderId),
          ]
        : [
            d1.prepare('INSERT INTO subscriptions (org_id, user_id, tier, plan, status, current_period_start, current_period_end) VALUES (?,?,?,?,?,?,?)')
              .bind(orgId, userId ?? null, effective.effectiveTier, effective.effectivePlan, 'active', now, effective.periodEnd),
            d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
              .bind(effective.effectivePlan, now, orgId),
            d1.prepare("UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=? AND status='pending'")
              .bind('completed', `payos_${orderCode}`, now, orderId),
          ]
      : [];

    const mcuGrant = resolvePayOsInitialMcuGrant(tier, billingPeriod);
    if (stmts.length > 0 && userId && mcuGrant > 0) {
      const nowSec = Math.floor(nowMs / 1000);
      const paymentRef = `payos_order_${orderId}`;
      stmts.push(
        d1.prepare(
          `INSERT INTO mcu_transactions (user_id, delta, reason, metadata, payment_reference)
           VALUES (?1, ?2, 'PAYOS_SUBSCRIPTION_ACTIVATION', ?3, ?4)
           ON CONFLICT(payment_reference) DO NOTHING`,
        ).bind(userId, mcuGrant, JSON.stringify({ orderId, tier, period: billingPeriod ?? 'monthly' }), paymentRef),
        d1.prepare(
          `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
           SELECT ?1, ?2, ?2, ?3 WHERE changes() = 1
           ON CONFLICT(user_id) DO UPDATE SET
             credits_remaining = credits_remaining + excluded.credits_remaining,
             credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
             updated_at = excluded.updated_at`,
        ).bind(userId, mcuGrant, nowSec),
      );
    }

    if (stmts.length > 0) await d1.batch(stmts);
    if (userId) invalidateUserTierCache(userId);
  } catch (batchErr) {
    logger.error('[PayOS IPN] Atomic batch failed; aborting without partial writes for clean retry', batchErr instanceof Error ? batchErr : new Error(String(batchErr)), { orderId, orderCode });
    throw batchErr;
  }
}