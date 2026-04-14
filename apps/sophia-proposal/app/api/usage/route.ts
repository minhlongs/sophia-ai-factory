import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/db/client';
import { resolveToken } from '@/lib/raas/resolve-token';
import { getOrgId } from '@/lib/org';
import { getUsageHistory, getUsageSummary } from '@/lib/billing/usage-tracker';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Derive orgId from JWT, NOT from user-controllable header
    const authClient = createAuthClient(await resolveToken(request));
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createServerClient();
    const orgId = await getOrgId(user.id, db);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const [summary, logs] = await Promise.all([
      getUsageSummary(orgId, days),
      getUsageHistory(orgId, limit, (page - 1) * limit),
    ]);

    return NextResponse.json({
      summary,
      logs,
      pagination: { page, limit, total: logs.length },
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
