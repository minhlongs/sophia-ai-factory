/**
 * RaaS Usage Stats — /api/raas/usage
 *
 * GET — Return aggregated API usage stats for the org
 *       Query: ?days=30 (default 30)
 *
 * Auth: Supabase session (dashboard users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/raas/auth-context';
import { getUsageStats } from '@/lib/raas/usage-meter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId } = auth;

    const days = Math.min(
      90,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('days') ?? '30', 10))
    );

    const stats = await getUsageStats(orgId, days);
    return NextResponse.json({ stats, days });
  } catch (err) {
    console.error('GET /api/raas/usage error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage stats' }, { status: 500 });
  }
}
