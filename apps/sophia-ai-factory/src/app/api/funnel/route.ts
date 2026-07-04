/**
 * GET /api/funnel
 *
 * Public funnel dashboard API. Returns aggregated funnel data for 4 conversion
 * funnels (activation, onboarding, video→paid, campaign lifecycle) within
 * the requested time window.
 *
 * Query params: from (unix s, default now-30d), to (unix s, default now).
 *
 * Requires authentication via getCurrentUser().
 *
 * @module app/api/funnel/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getFunnelDashboard } from '@/land/analytics/funnel-dashboard';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const now = Math.floor(Date.now() / 1000);
    const fromTs = fromParam ? parseInt(fromParam, 10) : now - 30 * 86400;
    const toTs = toParam ? parseInt(toParam, 10) : now;

    if (Number.isNaN(fromTs) || Number.isNaN(toTs) || fromTs > toTs) {
      return NextResponse.json(
        { error: 'Invalid from/to parameters. Use unix timestamps (seconds).' },
        { status: 400 },
      );
    }

    const dashboard = await getFunnelDashboard(fromTs, toTs);
    return NextResponse.json(dashboard);
  } catch (err) {
    logger.warn('[api/funnel] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Funnel query failed' }, { status: 500 });
  }
}
