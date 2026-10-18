/**
 * Subscription Lifecycle D1 Query Helpers
 *
 * Shared query and update helpers for cancel-subscription and resubscribe actions.
 *
 * @module land/billing/actions/subscription-lifecycle-queries
 */

import { normalizePlanToTier } from '@/seed/db/get-user-tier';
import type { Tier } from '@/seed/types';

export interface SubscriptionLifecycleRow {
  id: string;
  org_id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end?: number;
  cancellation_date?: string | null;
}

export const RESUBSCRIBE_GRACE_PERIOD_DAYS = 30;

export function calculateRemainingDays(periodEndIso: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(periodEndIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
}

export async function fetchActiveSubscriptionByOrg(
  d1: D1Database,
  orgId: string,
): Promise<SubscriptionLifecycleRow | null> {
  return d1
    .prepare(
      "SELECT id, org_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, cancellation_date FROM subscriptions WHERE org_id = ? AND status = 'active' LIMIT 1",
    )
    .bind(orgId)
    .first<SubscriptionLifecycleRow>();
}

export async function markSubscriptionCancelAtPeriodEnd(
  d1: D1Database,
  subscriptionId: string,
  nowIso: string,
): Promise<void> {
  await d1
    .prepare(
      'UPDATE subscriptions SET cancel_at_period_end = 1, cancellation_date = ?, updated_at = ? WHERE id = ?',
    )
    .bind(nowIso, nowIso, subscriptionId)
    .run();
}

export async function fetchLatestSubscriptionByOrg(
  d1: D1Database,
  orgId: string,
): Promise<SubscriptionLifecycleRow | null> {
  return d1
    .prepare(
      'SELECT id, org_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, cancellation_date FROM subscriptions WHERE org_id = ? ORDER BY created_at DESC LIMIT 1',
    )
    .bind(orgId)
    .first<SubscriptionLifecycleRow>();
}

export async function restoreCancelledSubscriptionInDb(
  d1: D1Database,
  sub: SubscriptionLifecycleRow,
): Promise<{ tier: Tier; nextBillingDate: string }> {
  const now = new Date().toISOString();
  const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await d1
    .prepare(
      `UPDATE subscriptions
       SET cancel_at_period_end = 0,
           cancellation_date = NULL,
           current_period_start = ?,
           current_period_end = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(now, newPeriodEnd, now, sub.id)
    .run();

  return {
    tier: normalizePlanToTier(sub.plan),
    nextBillingDate: newPeriodEnd,
  };
}
