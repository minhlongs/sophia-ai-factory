'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { revalidatePath } from 'next/cache';
import { logger } from '@/seed/utils/logger-utility';
import type { ReinstateSubscriptionResult } from './types';

/**
 * Reinstate a cancelled subscription.
 *
 * Checks if the user has a cancelled subscription and updates it back to active.
 * This is the minimum viable implementation - just updates status.
 * Payment reactivation with NOWPayments/PayOS can be handled separately.
 *
 * @returns ReinstateSubscriptionResult with success status
 */
export async function reinstateSubscriptionAction(): Promise<ReinstateSubscriptionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = createServerClient();

    // Step 1: Find user's organization
    const orgId = await resolveOrgId(user.id, db);
    if (!orgId) {
      logger.warn('[reinstateSubscriptionAction] No organization found for user', { userId: user.id });
      return { success: false, error: 'no_organization' };
    }

    // Step 2: Find the subscription
    const { data: subscription, error: subError } = await db
      .from('subscriptions')
      .select('id, plan, status, current_period_end')
      .eq('org_id', orgId)
      .limit(1)
      .single();

    if (subError || !subscription) {
      logger.warn('[reinstateSubscriptionAction] No subscription found', { userId: user.id, orgId });
      return { success: false, error: 'no_subscription' };
    }

    // Step 3: Check if subscription is cancelled
    if (subscription.status !== 'cancelled') {
      logger.info('[reinstateSubscriptionAction] Subscription not cancelled', {
        userId: user.id,
        orgId,
        status: subscription.status,
      });
      return { success: false, error: 'not_cancelled' };
    }

    // Prevent reinstating subscriptions whose paid period has expired
    if (subscription.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end as string).getTime();
      if (periodEnd < Date.now()) {
        logger.info('[reinstateSubscriptionAction] Subscription period expired', {
          userId: user.id,
          orgId,
          subscriptionId: subscription.id,
          currentPeriodEnd: subscription.current_period_end,
        });
        return { success: false, error: 'payment_required' };
      }
    }

    // Step 4: Update subscription status to active
    const now = new Date().toISOString();
    const { error: updateError } = await db
      .from('subscriptions')
      .update({ status: 'active', updated_at: now })
      .eq('id', subscription.id);

    if (updateError) {
      logger.error('[reinstateSubscriptionAction] Failed to update subscription', { error: String(updateError) });
      return { success: false, error: 'db_error' };
    }

    logger.info('[reinstateSubscriptionAction] Subscription reinstated', {
      userId: user.id,
      orgId,
      subscriptionId: subscription.id,
      plan: subscription.plan,
    });

    revalidatePath('/dashboard/billing');
    return { success: true };
  } catch (err) {
    logger.error('[reinstateSubscriptionAction] Unexpected error', err instanceof Error ? err : undefined);
    return { success: false, error: 'internal_error' };
  }
}
