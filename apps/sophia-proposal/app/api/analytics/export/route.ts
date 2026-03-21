/**
 * GET /api/analytics/export
 *
 * Export analytics data as CSV or JSON.
 *
 * Query params:
 *   format    — "csv" | "json"  (default: "json")
 *   type      — "metrics" | "conversions" | "usage"  (required)
 *   dateRange — number of days to look back  (default: 30)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/supabase/client';
import { getOrgId } from '@/lib/org';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportFormat = 'csv' | 'json';
type ExportType = 'metrics' | 'conversions' | 'usage';

interface Row {
  [key: string]: string | number | null;
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function escapeCell(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Wrap in quotes when the value contains commas, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: Row[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Data fetchers — return Row[] arrays
// ---------------------------------------------------------------------------

async function fetchMetricsRows(
  serverClient: ReturnType<typeof createServerClient>,
  orgId: string,
  days: number
): Promise<Row[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { count: newUsers } = await serverClient
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', startDate.toISOString());

  const { count: activatedUsers } = await serverClient
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', startDate.toISOString());

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: activeUsers } = await serverClient
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', sevenDaysAgo.toISOString());

  const { data: subscription } = await serverClient
    .from('subscriptions')
    .select('tier_name')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .single();

  const { count: promoters } = await serverClient
    .from('customer_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('nps_score', 9)
    .gte('submitted_at', startDate.toISOString());

  return [
    { stage: 'Acquisition', value: newUsers ?? 0, description: 'New users' },
    { stage: 'Activation', value: activatedUsers ?? 0, description: 'Created first proposal' },
    { stage: 'Retention', value: activeUsers ?? 0, description: 'Active in last 7 days' },
    { stage: 'Revenue', value: subscription ? 1 : 0, description: subscription?.tier_name ?? 'No subscription' },
    { stage: 'Referral', value: promoters ?? 0, description: 'NPS Promoters (9-10)' },
  ];
}

async function fetchConversionsRows(
  serverClient: ReturnType<typeof createServerClient>,
  orgId: string,
  days: number
): Promise<Row[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: proposals } = await serverClient
    .from('proposals')
    .select('status, generated_at, updated_at, created_at')
    .eq('org_id', orgId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  const total = proposals?.length ?? 0;
  const generated = proposals?.filter((p) => p.generated_at).length ?? 0;
  const viewed = proposals?.filter(
    (p) => p.status === 'viewed' || p.status === 'sent'
  ).length ?? 0;
  const won = proposals?.filter((p) => p.status === 'won').length ?? 0;
  const lost = proposals?.filter((p) => p.status === 'lost').length ?? 0;

  const pct = (num: number, den: number) =>
    den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '0%';

  return [
    { stage: 'Created', count: total, conversion_rate: '100%' },
    { stage: 'Generated', count: generated, conversion_rate: pct(generated, total) },
    { stage: 'Viewed/Sent', count: viewed, conversion_rate: pct(viewed, generated) },
    { stage: 'Won', count: won, conversion_rate: pct(won, viewed) },
    { stage: 'Lost', count: lost, conversion_rate: pct(lost, total) },
    { stage: 'Overall Win Rate', count: won, conversion_rate: pct(won, total) },
  ];
}

async function fetchUsageRows(
  serverClient: ReturnType<typeof createServerClient>,
  orgId: string,
  days: number
): Promise<Row[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: usageData } = await serverClient
    .from('usage_logs')
    .select('feature, mcu_cost, created_at')
    .eq('org_id', orgId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(5000);

  const featureMap: Record<string, { count: number; mcu: number }> = {};

  usageData?.forEach((log) => {
    if (!featureMap[log.feature]) {
      featureMap[log.feature] = { count: 0, mcu: 0 };
    }
    featureMap[log.feature].count++;
    featureMap[log.feature].mcu += log.mcu_cost;
  });

  return Object.entries(featureMap).map(([feature, data]) => ({
    feature,
    uses: data.count,
    mcu_total: data.mcu,
    mcu_per_use: data.count > 0 ? Math.round(data.mcu / data.count) : 0,
  }));
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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

    // 2. Parse query params
    const params = request.nextUrl.searchParams;
    const format = (params.get('format') ?? 'json') as ExportFormat;
    const type = params.get('type') as ExportType | null;
    const dateRange = Math.min(
      parseInt(params.get('dateRange') ?? '30', 10),
      365 // cap at 1 year to avoid enormous queries
    );

    if (!type || !['metrics', 'conversions', 'usage'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: metrics | conversions | usage' },
        { status: 400 }
      );
    }

    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be: csv | json' },
        { status: 400 }
      );
    }

    // 3. Get organization
    const serverClient = createServerClient();
    const orgId = await getOrgId(user.id, serverClient);

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // 4. Fetch rows based on requested type
    let rows: Row[];

    if (type === 'metrics') {
      rows = await fetchMetricsRows(serverClient, orgId, dateRange);
    } else if (type === 'conversions') {
      rows = await fetchConversionsRows(serverClient, orgId, dateRange);
    } else {
      rows = await fetchUsageRows(serverClient, orgId, dateRange);
    }

    // 5. Return in requested format
    const filename = `analytics-${type}-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const csv = rowsToCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      type,
      dateRange,
      exportedAt: new Date().toISOString(),
      rows,
    });
  } catch (error) {
    console.error('Analytics export error:', error);
    return NextResponse.json(
      { error: 'Failed to export analytics' },
      { status: 500 }
    );
  }
}
