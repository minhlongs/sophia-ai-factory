import { resolveOrgId } from '@/seed/auth/workspace-access';
import { invalidateOrgIdCache } from '@/seed/auth/org-resolver';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { invalidateUserTierCache } from '@/seed/db/get-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

export interface SubscriptionActivationResult {
  orgId: string;
  periodEnd: string;
  isLifetime: boolean;
}

export function calculatePayOsPeriodEnd(tier: Tier, orderPeriod?: string): { isLifetime: boolean; periodEnd: string } {
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime';
  const periodEnd = isLifetime
    ? new Date('2099-12-31T23:59:59Z').toISOString()
    : orderPeriod === 'yearly'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { isLifetime, periodEnd };
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
  const now = new Date().toISOString();
  const { isLifetime, periodEnd } = calculatePayOsPeriodEnd(tier, order.period);
  const rawDb = db.unwrap();
  const eventId = `payos_${paymentLinkId}`;
  let orgId = await resolveOrgId(userId, db);
  const createdOrg = !orgId;
  if (!orgId) {
    orgId = crypto.randomUUID();
    logger.warn('[PayOS Webhook] No org membership found; creating a dedicated customer org', { userId, orgId });
  }

  const subscriptionState = createdOrg
    ? { id: null, count: 0 }
    : await rawDb
        .prepare('SELECT MIN(id) AS id, COUNT(*) AS count FROM subscriptions WHERE org_id = ?1')
        .bind(orgId)
        .first<{ id: string | null; count: number }>();
  if (!subscriptionState || subscriptionState.count > 1) {
    throw new Error('PayOS activation requires an unambiguous organization subscription');
  }

  const lockExists =
    'EXISTS (SELECT 1 FROM payment_events WHERE event_id = ? AND created_at = ? AND processed = 2)';
  const planLower = tier.toLowerCase();
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
        .bind(orgId, userId, tier, planLower, now, periodEnd, eventId, lockCreatedAt),
    );
  } else if (subscriptionState.id) {
    statements.push(
      rawDb
        .prepare(`UPDATE subscriptions SET tier = ?1, plan = ?2, status = 'active', current_period_end = ?3, updated_at = ?4 WHERE id = ?5 AND org_id = ?6 AND ${lockExists}`)
        .bind(tier, planLower, periodEnd, now, subscriptionState.id, orgId, eventId, lockCreatedAt),
    );
  } else {
    statements.push(
      rawDb
        .prepare(`INSERT INTO subscriptions (org_id, user_id, tier, plan, status, current_period_start, current_period_end) SELECT ?1, ?2, ?3, ?4, 'active', ?5, ?6 WHERE ${lockExists}`)
        .bind(orgId, userId, tier, planLower, now, periodEnd, eventId, lockCreatedAt),
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
    rawDb
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1 AND created_at = ?2 AND processed = 2')
      .bind(eventId, lockCreatedAt),
  );

  const results = await rawDb.batch(statements);
  if (results.some((result) => !result.success || result.error)) {
    throw new Error('PayOS entitlement transaction failed');
  }
  const noChanges = results.findIndex((result) => result.meta?.changes !== 1);
  if (noChanges !== -1) {
    throw new Error(`PayOS entitlement transaction changed an unexpected number of rows at statement ${noChanges}`);
  }

  if (createdOrg) invalidateOrgIdCache(userId);
  invalidateUserTierCache(userId);

  return { orgId, periodEnd, isLifetime };
}
