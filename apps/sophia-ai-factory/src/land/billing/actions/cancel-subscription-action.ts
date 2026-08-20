/**
 * Cancel Subscription Server Action
 *
 * Allows an authenticated user to cancel their subscription.
 * - Sets cancel_at_period_end = true so the subscription remains active
 *   until the current billing period ends.
 * - Blocked during dunning (payment issues).
 * - Returns error if no active subscription found.
 *
 * @module land/billing/actions/cancel-subscription-action
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { BillingError } from './change-tier-action';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CancelResult {
  endDate: string;
  remainingDays: number;
  tier: string;
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

// ── Dunning state check ───────────────────────────────────────────────────

async function isUserInDunning(userId: string): Promise<boolean> {
  try {
    const d1 = await getD1();
    if (!d1) return false;

    const row = await d1
      .prepare('SELECT dunning_state FROM dunning_settings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(userId)
      .first<{ dunning_state: string }>();

    if (!row) return false;
    return row.dunning_state !== 'current';
  } catch {
    return false;
  }
}

// ── Main action ───────────────────────────────────────────────────────────

export async function cancelSubscription(): Promise<Result<CancelResult, BillingError>> {
  try {
    // Auth gate
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    // Get D1
    const d1 = await getD1();
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

    // Get current subscription
    const sub = await d1
      .prepare(
        "SELECT id, org_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, cancellation_date FROM subscriptions WHERE org_id = ? AND status = 'active' LIMIT 1",
      )
      .bind(orgId)
      .first<SubscriptionRow>();

    if (!sub) {
      return failure({ code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No active subscription found' });
    }

    // Already cancelled check
    if (sub.cancel_at_period_end === 1) {
      return success({
        endDate: sub.current_period_end,
        remainingDays: Math.max(0, Math.ceil(
          (new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )),
        tier: sub.plan,
      });
    }

    // Dunning check
    const inDunning = await isUserInDunning(user.id);
    if (inDunning) {
      return failure({
        code: 'IN_DUNNING',
        message: 'Cannot cancel subscription while account is in dunning state. Please resolve outstanding payments first.',
      });
    }

    // Set end_date to current period end
    const now = new Date().toISOString();

    await d1.prepare(
      'UPDATE subscriptions SET cancel_at_period_end = 1, cancellation_date = ?, updated_at = ? WHERE id = ?',
    ).bind(now, now, sub.id).run();

    const remainingDays = Math.max(0, Math.ceil(
      (new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ));

    logger.info('[CancelSubscription] Subscription cancelled', {
      userId: user.id,
      orgId,
      endDate: sub.current_period_end,
      remainingDays,
    });

    return success({
      endDate: sub.current_period_end,
      remainingDays,
      tier: sub.plan,
    });
  } catch (err) {
    logger.error('[CancelSubscription] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
