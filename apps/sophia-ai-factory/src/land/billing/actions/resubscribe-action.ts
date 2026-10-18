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
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { Tier } from '@/seed/types';
import type { BillingError } from './change-tier-action';
import {
  RESUBSCRIBE_GRACE_PERIOD_DAYS,
  fetchLatestSubscriptionByOrg,
  restoreCancelledSubscriptionInDb,
} from './subscription-lifecycle-queries';

export interface ResubscribeResult {
  tier: Tier;
  nextBillingDate: string;
}

export async function resubscribe(): Promise<Result<ResubscribeResult, BillingError>> {
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

    const sub = await fetchLatestSubscriptionByOrg(d1, orgId);
    if (!sub) {
      return failure({ code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No subscription found to restore' });
    }

    if (sub.cancel_at_period_end !== 1) {
      return failure({
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'Subscription is already active. No cancellation to revert.',
      });
    }

    if (!sub.cancellation_date) {
      return failure({ code: 'DB_ERROR', message: 'Cancellation date not found' });
    }

    const cancellationDate = new Date(sub.cancellation_date).getTime();
    const gracePeriodEnd = new Date(
      cancellationDate + RESUBSCRIBE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );

    if (Date.now() > gracePeriodEnd.getTime()) {
      return failure({
        code: 'GRACE_PERIOD_EXPIRED',
        message: `Grace period of ${RESUBSCRIBE_GRACE_PERIOD_DAYS} days has expired. Please create a new subscription.`,
      });
    }

    const { tier, nextBillingDate } = await restoreCancelledSubscriptionInDb(d1, sub);

    logger.info('[Resubscribe] Subscription restored', {
      userId: user.id,
      orgId,
      subscriptionId: sub.id,
      tier,
      nextBillingDate,
    });

    return success({ tier, nextBillingDate });
  } catch (err) {
    logger.error('[Resubscribe] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
