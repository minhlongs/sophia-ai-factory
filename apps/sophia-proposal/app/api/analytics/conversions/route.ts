/**
 * GET /api/analytics/conversions
 *
 * Get proposal conversion funnel
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/supabase/client';
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

    // 3. Get proposal funnel data
    const { data: proposals } = await serverClient
      .from('proposals')
      .select('status, generated_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    // 4. Calculate funnel stages
    const total = proposals?.length || 0;
    const generated = proposals?.filter((p) => p.generated_at).length || 0;
    const viewed =
      proposals?.filter((p) => p.status === 'viewed' || p.status === 'sent')
        .length || 0;
    const won = proposals?.filter((p) => p.status === 'won').length || 0;
    const lost = proposals?.filter((p) => p.status === 'lost').length || 0;

    // 5. Calculate conversion rates
    const generateToView =
      generated > 0 ? ((viewed / generated) * 100).toFixed(1) : '0';
    const viewToWon =
      viewed > 0 ? ((won / viewed) * 100).toFixed(1) : '0';
    const overallWinRate =
      total > 0 ? ((won / total) * 100).toFixed(1) : '0';

    return NextResponse.json({
      success: true,
      funnel: {
        total,
        stages: [
          {
            name: 'Created',
            count: total,
            conversionRate: '100%',
          },
          {
            name: 'Generated',
            count: generated,
            conversionRate: `${((generated / total) * 100).toFixed(1)}%`,
          },
          {
            name: 'Viewed/Sent',
            count: viewed,
            conversionRate: `${generateToView}%`,
          },
          {
            name: 'Won',
            count: won,
            conversionRate: `${viewToWon}%`,
          },
        ],
        lost,
        overallWinRate: `${overallWinRate}%`,
      },
    });
  } catch (error) {
    console.error('Conversion analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversion data' },
      { status: 500 }
    );
  }
}
