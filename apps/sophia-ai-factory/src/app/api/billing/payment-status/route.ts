/**
 * GET /api/billing/payment-status
 *
 * Returns current payment status for dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger-utility';
import type { PaymentStatus } from '@/lib/billing/billing-types';

/**
 * GET /api/billing/payment-status
 * Returns: { status, pastDueAmount, nextRetryDate, dunningAttemptsRemaining }
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile with subscription info
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_expires_at, metadata')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({
        status: 'unknown',
        message: 'No profile found',
      });
    }

    // Determine payment status
    let paymentStatus: PaymentStatus = {
      status: 'active',
      stripeCustomerId: profile.stripe_customer_id || undefined,
      stripeSubscriptionId: profile.stripe_subscription_id || undefined,
    };

    // Check subscription status
    const subscriptionStatus = profile.subscription_status;

    if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'expired') {
      paymentStatus.status = 'cancelled' as const;
    } else if (subscriptionStatus === 'past_due') {
      paymentStatus.status = 'past_due' as const;

      // Get past due amount from metadata or Stripe
      const metadata = profile.metadata as Record<string, any> || {};
      paymentStatus.pastDueAmountCents = metadata.past_due_amount_cents || 0;

      // Check for dunning attempts
      const { data: dunningAttempts } = await supabase
        .from('dunning_attempts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single();

      if (dunningAttempts) {
        paymentStatus.nextRetryDate = dunningAttempts.scheduled_at;
        paymentStatus.status = 'dunning' as const;
      }

      // Calculate remaining attempts
      const { count: completedAttempts } = await supabase
        .from('dunning_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['success', 'failed']);

      paymentStatus.dunningAttemptsRemaining = Math.max(0, 3 - (completedAttempts || 0));
    }

    // Add current period end
    if (profile.subscription_expires_at) {
      paymentStatus.currentPeriodEnd = new Date(profile.subscription_expires_at).getTime();
    }

    return NextResponse.json(paymentStatus);
  } catch (error) {
    logger.error('[Billing API] Error fetching payment status', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch payment status' },
      { status: 500 }
    );
  }
}
