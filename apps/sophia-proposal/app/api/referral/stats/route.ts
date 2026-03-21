/**
 * GET /api/referral/stats
 *
 * Returns referral stats for the authenticated org:
 * clicks, signups, conversions, total_earned, pending_payout, payout history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserOrganization } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const user = await getCurrentUser(cookie);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await getUserOrganization(user.id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const supabase = createServerClient();

    // Fetch active referral code with aggregate stats
    const { data: referralCode } = await supabase
      .from('referral_codes')
      .select('code, clicks, signups, conversions, total_earned, commission_rate, is_active')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .single();

    // Pending payout total
    const { data: pendingPayouts } = await supabase
      .from('affiliate_payouts')
      .select('amount')
      .eq('org_id', org.id)
      .eq('status', 'pending');

    const pendingAmount = (pendingPayouts || []).reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    // Recent payout history (last 10)
    const { data: payoutHistory } = await supabase
      .from('affiliate_payouts')
      .select('id, amount, status, payout_method, period_start, period_end, created_at')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Recent events (last 20)
    const { data: recentEvents } = await supabase
      .from('referral_events')
      .select('event_type, metadata, created_at')
      .eq('referrer_org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      code: referralCode?.code || null,
      stats: {
        clicks: referralCode?.clicks || 0,
        signups: referralCode?.signups || 0,
        conversions: referralCode?.conversions || 0,
        total_earned: referralCode?.total_earned || 0,
        pending_payout: pendingAmount,
        commission_rate: referralCode?.commission_rate || 0.20,
      },
      payout_history: payoutHistory || [],
      recent_events: recentEvents || [],
    });
  } catch (e) {
    console.error('GET /api/referral/stats error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
