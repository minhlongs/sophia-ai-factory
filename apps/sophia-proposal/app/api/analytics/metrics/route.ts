/**
 * GET /api/analytics/metrics
 *
 * Get AARRR funnel metrics for organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/db/client';
import { getOrgId } from '@/lib/org';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
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

    // 3. Get date range from query params
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 4. Calculate AARRR metrics

    // Acquisition: New users/signups
    const { count: newUsers } = await serverClient
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', startDate.toISOString());

    // Activation: Users who created first proposal
    const { count: activatedUsers } = await serverClient
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', startDate.toISOString());

    // Retention: Active users (used feature in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: activeUsers } = await serverClient
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', sevenDaysAgo.toISOString());

    // Revenue: Proposals from paying orgs
    const { data: subscription } = await serverClient
      .from('subscriptions')
      .select('tier_name, status')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .single();

    // Referral: NPS responses with score 9-10
    const { count: promoters } = await serverClient
      .from('customer_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('nps_score', 9)
      .gte('submitted_at', startDate.toISOString());

    // 5. Calculate conversion rates
    const acquisitionToActivation =
      newUsers && activatedUsers
        ? ((activatedUsers / newUsers) * 100).toFixed(1)
        : '0';

    const activationToRetention =
      activatedUsers && activeUsers
        ? ((activeUsers / activatedUsers) * 100).toFixed(1)
        : '0';

    return NextResponse.json({
      success: true,
      metrics: {
        acquisition: {
          label: 'Acquisition',
          value: newUsers || 0,
          description: 'New users',
        },
        activation: {
          label: 'Activation',
          value: activatedUsers || 0,
          description: 'Created first proposal',
          conversionRate: `${acquisitionToActivation}%`,
        },
        retention: {
          label: 'Retention',
          value: activeUsers || 0,
          description: 'Active in last 7 days',
          conversionRate: `${activationToRetention}%`,
        },
        revenue: {
          label: 'Revenue',
          value: subscription ? 1 : 0,
          description: subscription?.tier_name || 'No subscription',
        },
        referral: {
          label: 'Referral',
          value: promoters || 0,
          description: 'NPS Promoters (9-10)',
        },
      },
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
