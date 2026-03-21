/**
 * GET /api/billing/subscription
 *
 * Returns current subscription status for the user's organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/db/auth';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user from request cookies
    const cookies = request.headers.get('cookie') || '';
    const user = await getCurrentUser(cookies);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get user's organization
    const db = createServerClient();
    const { data: orgMember } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // 3. Get subscription and balance
    const [subscriptionResult, balanceResult] = await Promise.all([
      db
        .from('subscriptions')
        .select('*')
        .eq('org_id', orgMember.org_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        .then(r => r.data),

      db
        .from('org_balances')
        .select('*')
        .eq('org_id', orgMember.org_id)
        .single()
        .then(r => r.data),
    ]);

    return NextResponse.json({
      subscription: subscriptionResult ? {
        id: subscriptionResult.id,
        tierName: subscriptionResult.tier_name,
        status: subscriptionResult.status,
        mcuMonthly: subscriptionResult.mcu_monthly,
        currentPeriodEnd: subscriptionResult.current_period_end,
        cancelAtPeriodEnd: subscriptionResult.cancel_at_period_end,
      } : null,
      balance: balanceResult ? {
        balance: balanceResult.balance,
        lifetimeCredits: balanceResult.lifetime_credits,
        lifetimeUsed: balanceResult.lifetime_used,
      } : null,
    });

  } catch (error) {
    console.error('Subscription fetch error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
