/**
 * GET /api/analytics/usage
 *
 * Get feature usage metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/db/client';
import { getOrgId } from '@/lib/org';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authClient = createAuthClient(
      request.headers.get('authorization')?.split(' ')[1]
    );
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get organization
    const serverClient = createServerClient();
    const orgId = await getOrgId(user.id, serverClient);

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // 3. Get usage by feature
    const { data: usageData } = await serverClient
      .from('usage_logs')
      .select('feature, mcu_cost, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1000);

    // 4. Aggregate by feature
    const featureUsage: Record<string, { count: number; mcu: number }> = {};

    usageData?.forEach((log) => {
      if (!featureUsage[log.feature]) {
        featureUsage[log.feature] = { count: 0, mcu: 0 };
      }
      featureUsage[log.feature].count++;
      featureUsage[log.feature].mcu += log.mcu_cost;
    });

    // 5. Get current MCU balance
    const { data: balance } = await serverClient
      .from('org_balances')
      .select('balance')
      .eq('org_id', orgId)
      .single();

    // 6. Get subscription tier
    const { data: subscription } = await serverClient
      .from('subscriptions')
      .select('tier_name, mcu_monthly')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .single();

    // 7. Calculate daily usage trend (last 7 days)
    const dailyUsage: Record<string, number> = {};
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyUsage[dateStr] = 0;
    }

    usageData?.forEach((log) => {
      const dateStr = log.created_at.split('T')[0];
      if (dailyUsage[dateStr] !== undefined) {
        dailyUsage[dateStr] += log.mcu_cost;
      }
    });

    return NextResponse.json({
      success: true,
      usage: {
        byFeature: Object.entries(featureUsage).map(([feature, data]) => ({
          feature,
          count: data.count,
          mcuCost: data.mcu,
        })),
        balance: {
          current: balance?.balance || 0,
          monthly: subscription?.mcu_monthly || 0,
          tier: subscription?.tier_name || 'free',
        },
        dailyTrend: Object.entries(dailyUsage).map(([date, mcu]) => ({
          date,
          mcu,
        })),
      },
    });
  } catch (error) {
    console.error('Usage analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
