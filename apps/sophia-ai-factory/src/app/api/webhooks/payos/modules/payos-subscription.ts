import { resolveOrgId } from '@/seed/auth/workspace-access';
import { invalidateOrgIdCache } from '@/seed/auth/org-resolver';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { invalidateUserTierCache, normalizePlanToTier } from '@/seed/db/get-user-tier';
import { wouldDowngradeTier } from '@/land/billing/nowpayments-ipn-utils';
import { logger } from '@/seed/utils/logger-utility';
import { PAID_PILOT_DURATION_DAYS } from '@/tree/finance/pilot-unit-economics-types';
import type { Tier } from '@/seed/types';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

export const PAID_PILOT_14_DAY_MCU_GRANT = 500;

export function resolvePayOsInitialMcuGrant(tier: Tier, orderPeriod?: string): number {
  if (orderPeriod === 'pilot_14d') {
    return PAID_PILOT_14_DAY_MCU_GRANT;
  }
  const monthly = UNIFIED_TIERS[tier]?.mcuMonthly ?? 0;
  return monthly > 0 ? monthly : 0;
}

export interface SubscriptionActivationResult {
  orgId: string;
  periodEnd: string;
  isLifetime: boolean;
}

export function calculatePayOsPeriodEnd(
  tier: Tier,
  orderPeriod?: string,
  nowMs: number = Date.now(),
): { isLifetime: boolean; periodEnd: string } {
  if (orderPeriod === 'pilot_14d' && tier !== 'BASIC') {
    throw new Error('14-day Paid Pilot billing is only valid for BASIC tier');
  }
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime';
  const periodEnd = isLifetime
    ? new Date('2099-12-31T23:59:59Z').toISOString()
    : orderPeriod === 'pilot_14d'
      ? new Date(nowMs + PAID_PILOT_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : orderPeriod === 'yearly'
        ? new Date(nowMs + 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { isLifetime, periodEnd };
}

export function resolveEffectiveSubscriptionState(params: {
  purchasedTier: Tier;
  orderPeriod?: string;
  nowMs: number;
  existing?: {
    plan?: string | null;
    tier?: string | null;
    status?: string | null;
    current_period_start?: string | null;
    current_period_end?: string | null;
  } | null;
}): { effectiveTier: Tier; effectivePlan: string; periodStart: string; periodEnd: string; isLifetime: boolean } {
  const { purchasedTier, orderPeriod, nowMs, existing } = params;
  const nowIso = new Date(nowMs).toISOString();
  const base = calculatePayOsPeriodEnd(purchasedTier, orderPeriod, nowMs);
  if (!existing || existing.status !== 'active') {
    return {
      effectiveTier: purchasedTier,
      effectivePlan: purchasedTier.toLowerCase(),
      periodStart: nowIso,
      periodEnd: base.periodEnd,
      isLifetime: base.isLifetime,
    };
  }

  const rawCurrent = (existing.tier ?? existing.plan ?? '').trim();
  const normalizedCurrentTier = rawCurrent ? normalizePlanToTier(rawCurrent) : null;
  const existingEndMs = existing.current_period_end ? Date.parse(existing.current_period_end) : NaN;
  const currentIsLifetime =
    normalizedCurrentTier !== null && UNIFIED_TIERS[normalizedCurrentTier]?.billingType === 'lifetime';
  const hasFutureEntitlement =
    existing.current_period_end == null
      ? currentIsLifetime
      : Number.isFinite(existingEndMs) && existingEndMs > nowMs;

  if (!hasFutureEntitlement) {
    return {
      effectiveTier: purchasedTier,
      effectivePlan: purchasedTier.toLowerCase(),
      periodStart: nowIso,
      periodEnd: base.periodEnd,
      isLifetime: base.isLifetime,
    };
  }

  const preservedStart = existing.current_period_start || nowIso;

  if (normalizedCurrentTier && wouldDowngradeTier(normalizedCurrentTier, purchasedTier)) {
    const preservedIsLifetime = UNIFIED_TIERS[normalizedCurrentTier]?.billingType === 'lifetime';
    const preservedEnd =
      existing.current_period_end ??
      (preservedIsLifetime ? new Date('2099-12-31T23:59:59Z').toISOString() : base.periodEnd);
    return {
      effectiveTier: normalizedCurrentTier,
      effectivePlan: normalizedCurrentTier.toLowerCase(),
      periodStart: preservedStart,
      periodEnd: preservedEnd,
      isLifetime: preservedIsLifetime,
    };
  }

  if (base.isLifetime) {
    return {
      effectiveTier: purchasedTier,
      effectivePlan: purchasedTier.toLowerCase(),
      periodStart: preservedStart,
      periodEnd: base.periodEnd,
      isLifetime: true,
    };
  }

  const durationDays =
    orderPeriod === 'pilot_14d'
      ? PAID_PILOT_DURATION_DAYS
      : orderPeriod === 'yearly'
        ? 365
        : 30;
  const extendedEndIso = new Date(existingEndMs + durationDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    effectiveTier: purchasedTier,
    effectivePlan: purchasedTier.toLowerCase(),
    periodStart: preservedStart,
    periodEnd: extendedEndIso,
    isLifetime: false,
  };
}

export async function activatePayOsSubscription(params: {
  db: DbClient;
  userId: string;
  tier: Tier;
  order: PendingOrder;
  paymentLinkId: number | string;
  lockCreatedAt: string;
}): Promise<SubscriptionActivationResult> {
  const { db, userId, tier, order, paymentLinkId, lockCreatedAt } = params;
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const rawDb = db.unwrap();
  const eventId = `payos_${paymentLinkId}`;
  let orgId = await resolveOrgId(userId, db);
  const createdOrg = !orgId;
  if (!orgId) {
    orgId = crypto.randomUUID();
    logger.warn('[PayOS Webhook] No org membership found; creating a dedicated customer org', { userId, orgId });
  }

  const subscriptionState = createdOrg
    ? { id: null, count: 0, plan: null, tier: null, status: null, current_period_start: null, current_period_end: null }
    : await rawDb
        .prepare(
          `SELECT MIN(id) AS id, COUNT(*) AS count,
                  MIN(plan) AS plan, MIN(tier) AS tier,
                  MIN(status) AS status, MIN(current_period_start) AS current_period_start,
                  MIN(current_period_end) AS current_period_end
           FROM subscriptions WHERE org_id = ?1`,
        )
        .bind(orgId)
        .first<{
          id: string | null;
          count: number;
          plan?: string | null;
          tier?: string | null;
          status?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
        }>();
  if (!subscriptionState || subscriptionState.count > 1) {
    throw new Error('PayOS activation requires an unambiguous organization subscription');
  }

  const { effectiveTier, effectivePlan: planLower, periodStart, periodEnd, isLifetime } =
    resolveEffectiveSubscriptionState({
      purchasedTier: tier,
      orderPeriod: order.period,
      nowMs,
      existing: subscriptionState.id ? subscriptionState : null,
    });

  const lockExists =
    'EXISTS (SELECT 1 FROM payment_events WHERE event_id = ? AND created_at = ? AND processed = 2)';
  const statements = [
    rawDb
      // Check mutable order and tenant state inside the batch, before any entitlement write.
      // Inspecting meta.changes after batch() cannot roll back a committed zero-row update.
      .prepare(`UPDATE payment_events SET processed = 2
        WHERE event_id = ?1 AND created_at = ?2 AND processed = 0
        AND EXISTS (SELECT 1 FROM pending_orders
          WHERE order_id = ?3 AND provider_payment_id = ?4 AND user_id = ?5
          AND status = 'pending' AND payment_method = 'payos'
          AND tier = ?6 AND period = ?7 AND amount_usd_cents = ?8 AND amount_vnd IS ?9)
        AND ((?10 = 1 AND NOT EXISTS (SELECT 1 FROM org_members WHERE user_id = ?5))
          OR (?10 = 0 AND EXISTS (SELECT 1 FROM organizations WHERE id = ?11)
            AND EXISTS (SELECT 1 FROM org_members WHERE org_id = ?11 AND user_id = ?5)
            AND (SELECT COUNT(*) FROM subscriptions WHERE org_id = ?11) = ?12
            AND (?12 = 0 OR EXISTS (SELECT 1 FROM subscriptions WHERE id = ?13 AND org_id = ?11))))`)
      .bind(eventId, lockCreatedAt, order.order_id, paymentLinkId, userId,
        tier, order.period, order.amount_usd_cents, order.amount_vnd ?? null,
        createdOrg ? 1 : 0, orgId, subscriptionState.count, subscriptionState.id),
  ];

  if (createdOrg) {
    const slug = `customer-${orgId.slice(0, 8)}`;
    statements.push(
      rawDb
        .prepare(`INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) SELECT ?1, ?2, ?3, ?4, ?5, ?5 WHERE ${lockExists}`)
        .bind(orgId, `User ${userId}`, slug, planLower, now, eventId, lockCreatedAt),
      rawDb
        .prepare(`INSERT INTO org_members (org_id, user_id, role) SELECT ?1, ?2, 'owner' WHERE EXISTS (SELECT 1 FROM organizations WHERE id = ?1) AND ${lockExists}`)
        .bind(orgId, userId, eventId, lockCreatedAt),
      rawDb
        .prepare(`INSERT INTO subscriptions (org_id, user_id, tier, plan, status, current_period_start, current_period_end) SELECT ?1, ?2, ?3, ?4, 'active', ?5, ?6 WHERE EXISTS (SELECT 1 FROM organizations WHERE id = ?1) AND ${lockExists}`)
        .bind(orgId, userId, effectiveTier, planLower, now, periodEnd, eventId, lockCreatedAt),
    );
  } else if (subscriptionState.id) {
    statements.push(
      rawDb
        .prepare(`UPDATE subscriptions SET tier = ?1, plan = ?2, status = 'active', current_period_start = ?3, current_period_end = ?4, updated_at = ?5 WHERE id = ?6 AND org_id = ?7 AND ${lockExists}`)
        .bind(effectiveTier, planLower, periodStart, periodEnd, now, subscriptionState.id, orgId, eventId, lockCreatedAt),
    );
  } else {
    statements.push(
      rawDb
        .prepare(`INSERT INTO subscriptions (org_id, user_id, tier, plan, status, current_period_start, current_period_end) SELECT ?1, ?2, ?3, ?4, 'active', ?5, ?6 WHERE ${lockExists}`)
        .bind(orgId, userId, effectiveTier, planLower, now, periodEnd, eventId, lockCreatedAt),
    );
  }

  if (!createdOrg) {
    statements.push(
      rawDb
        .prepare(`UPDATE organizations SET plan = ?1, updated_at = ?2 WHERE id = ?3 AND ${lockExists}`)
        .bind(planLower, now, orgId, eventId, lockCreatedAt),
    );
  }

  statements.push(
    rawDb
      .prepare(`UPDATE pending_orders SET status = 'completed', payment_id = ?1, completed_at = ?2 WHERE order_id = ?3 AND provider_payment_id = ?4 AND status = 'pending' AND ${lockExists}`)
      .bind(`payos_${paymentLinkId}`, now, order.order_id, paymentLinkId, eventId, lockCreatedAt),
  );

  let mcuStatementStartIdx = -1;
  const mcuGrant = resolvePayOsInitialMcuGrant(tier, order.period);
  if (mcuGrant > 0) {
    try {
      const nowSec = Math.floor(nowMs / 1000);
      const paymentRef = `payos_order_${order.order_id}`;
      const txStmt = rawDb
        .prepare(
          `INSERT INTO mcu_transactions (user_id, delta, reason, metadata, payment_reference)
           SELECT ?1, ?2, 'PAYOS_SUBSCRIPTION_ACTIVATION', ?3, ?4
           WHERE ${lockExists}
           ON CONFLICT(payment_reference) WHERE payment_reference IS NOT NULL DO NOTHING`,
        )
        .bind(
          userId,
          mcuGrant,
          JSON.stringify({ orderId: order.order_id, tier, period: order.period ?? 'monthly', amountVnd: order.amount_vnd ?? null }),
          paymentRef,
          eventId,
          lockCreatedAt,
        );
      const balStmt = rawDb
        .prepare(
          `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
           SELECT ?1, ?2, ?2, ?3
           WHERE changes() = 1 AND ${lockExists}
           ON CONFLICT(user_id) DO UPDATE SET
             credits_remaining = credits_remaining + excluded.credits_remaining,
             credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
             updated_at = excluded.updated_at`,
        )
        .bind(userId, mcuGrant, nowSec, eventId, lockCreatedAt);
      mcuStatementStartIdx = statements.length;
      statements.push(txStmt, balStmt);
    } catch {
      mcuStatementStartIdx = -1;
    }
  }

  statements.push(
    rawDb
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1 AND created_at = ?2 AND processed = 2')
      .bind(eventId, lockCreatedAt),
  );

  const results = await rawDb.batch(statements);
  if (results.some((result) => !result.success || result.error)) {
    throw new Error('PayOS entitlement transaction failed');
  }
  const noChanges = results.findIndex((result, idx) => {
    if (mcuStatementStartIdx !== -1 && (idx === mcuStatementStartIdx || idx === mcuStatementStartIdx + 1)) {
      return result.meta?.changes !== 0 && result.meta?.changes !== 1;
    }
    return result.meta?.changes !== 1;
  });
  if (noChanges !== -1) {
    throw new Error(`PayOS entitlement transaction changed an unexpected number of rows at statement ${noChanges}`);
  }

  if (createdOrg) invalidateOrgIdCache(userId);
  invalidateUserTierCache(userId);

  return { orgId, periodEnd, isLifetime };
}
