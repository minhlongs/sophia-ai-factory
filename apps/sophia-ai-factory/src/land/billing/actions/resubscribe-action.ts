/**
 * Resubscribe Server Action
 *
 * Allows an authenticated user to restore a previously cancelled subscription.
 * - Must have a previous subscription with cancellation
 * - Must be within 30-day grace period from cancellation date
 * - Restores subscription with same tier and a new billing period from today
 *
 * @module land/billing/actions/resubscribe-action
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import { normalizePlanToTier } from '@/seed/db/get-user-tier';
import type { Tier } from '@/seed/types';
import type { BillingError } from './change-tier-action';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ResubscribeResult {
  tier: Tier;
  nextBillingDate: string;
}

// ── Subscription row shape ────────────────────────────────────────────────

interface SubscriptionRow {
  id: string;
  org_id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end?: number;
  cancellation_date?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────

const GRACE_PERIOD_DAYS = 30;

// ── Main action ───────────────────────────────────────────────────────────

export async function resubscribe(): Promise<Result<ResubscribeResult, BillingError>> {
  try {
    // Auth gate
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    // Get D1
    const d1 = getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Get org for user
    const member = await d1
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(user.id)
      .first<{ org_id: string }>();

    if (!member) {
      return failure({ code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No organization found' });
    }

    const orgId = member.org_id;

    // Get the subscription (most recent, even cancelled)
    const sub = await d1
      .prepare(
        "SELECT id, org_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, cancellation_date FROM subscriptions WHERE org_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .bind(orgId)
      .first<SubscriptionRow>();

    if (!sub) {
      return failure({ code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No subscription found to restore' });
    }

    // Check if cancelled
    if (sub.cancel_at_period_end !== 1) {
      return failure({
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'Subscription is already active. No cancellation to revert.',
      });
    }

    // Check grace period
    if (!sub.cancellation_date) {
      return failure({ code: 'DB_ERROR', message: 'Cancellation date not found' });
    }

    const cancellationDate = new Date(sub.cancellation_date).getTime();
    const gracePeriodEnd = new Date(cancellationDate + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    if (Date.now() > gracePeriodEnd.getTime()) {
      return failure({
        code: 'GRACE_PERIOD_EXPIRED',
        message: `Grace period of ${GRACE_PERIOD_DAYS} days has expired. Please create a new subscription.`,
      });
    }

    // Restore subscription: clear cancellation, set new period from today
    const now = new Date().toISOString();
    const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await d1.prepare(
      `UPDATE subscriptions
       SET cancel_at_period_end = 0,
           cancellation_date = NULL,
           current_period_start = ?,
           current_period_end = ?,
           updated_at = ?
       WHERE id = ?`,
    ).bind(now, newPeriodEnd, now, sub.id).run();

    const tier = normalizePlanToTier(sub.plan);

    logger.info('[Resubscribe] Subscription restored', {
      userId: user.id,
      orgId,
      subscriptionId: sub.id,
      tier,
      nextBillingDate: newPeriodEnd,
    });

    return success({
      tier,
      nextBillingDate: newPeriodEnd,
    });
  } catch (err) {
    logger.error('[Resubscribe] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
