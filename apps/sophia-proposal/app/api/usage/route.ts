import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { getUsageHistory, getUsageSummary } from '@/lib/billing/usage-tracker';

export async function GET(request: NextRequest) {
  try {
    // Get org ID from header (set by middleware or auth layer)
    const orgId = request.headers.get('x-org-id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify org exists and user has access (can be extended with auth check)
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
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
