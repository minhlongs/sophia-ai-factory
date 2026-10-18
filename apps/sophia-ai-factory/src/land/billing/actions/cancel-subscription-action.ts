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
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import { isUserInDunning } from '@/land/billing/dunning/check-user-dunning';
import type { BillingError } from './change-tier-action';
import {
  calculateRemainingDays,
  fetchActiveSubscriptionByOrg,
  markSubscriptionCancelAtPeriodEnd,
} from './subscription-lifecycle-queries';

export interface CancelSubscriptionOptions {
  /** Bypass dunning cache check (e.g. immediately returning from successful checkout redirect) */
  bypassDunningCache?: boolean;
}

export interface CancelResult {
  endDate: string;
  remainingDays: number;
  tier: string;
}

export async function cancelSubscription(
  options?: CancelSubscriptionOptions,
): Promise<Result<CancelResult, BillingError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const orgId = await resolveOrgId(user.id, d1);
    if (!orgId) {
      return failure({ code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No organization found' });
    }

    const sub = await fetchActiveSubscriptionByOrg(d1, orgId);
    if (!sub) {
      return failure({ code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No active subscription found' });
    }

    if (sub.cancel_at_period_end === 1) {
      return success({
        endDate: sub.current_period_end,
        remainingDays: calculateRemainingDays(sub.current_period_end),
        tier: sub.plan,
      });
    }

    const inDunning = await isUserInDunning(user.id, {
      bypassDunningCache: options?.bypassDunningCache,
      orgId,
      db: d1,
    });
    if (inDunning) {
      return failure({
        code: 'IN_DUNNING',
        message: 'Cannot cancel subscription while account is in dunning state. Please resolve outstanding payments first.',
      });
    }

    const now = new Date().toISOString();
    await markSubscriptionCancelAtPeriodEnd(d1, sub.id, now);
    const remainingDays = calculateRemainingDays(sub.current_period_end);

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
