/**
 * GET /api/health/deep — Deep health check (auth required).
 *
 * Returns D1 table counts, mission stats, MCU totals, error rates.
 * Auth: x-internal-secret header or admin session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getD1Client();
  const results: Record<string, unknown> = {};

  // Table row counts
  const tables = ['users', 'organizations', 'missions', 'mission_templates', 'org_balances'];
  for (const table of tables) {
    try {
      const { data } = await db.from(table).select('id', { count: 'exact' });
      results[`${table}_count`] = Array.isArray(data) ? data.length : 0;
    } catch {
      results[`${table}_count`] = 'error';
    }
  }

  // Mission status breakdown (last 24h)
  const since = new Date(Date.now() - 86_400_000).toISOString();
  try {
    const { data: missions } = await db
      .from('missions')
      .select('status')
      .gte('created_at', since);

    const breakdown: Record<string, number> = {};
    for (const m of (missions ?? []) as Array<{ status: string }>) {
      breakdown[m.status] = (breakdown[m.status] ?? 0) + 1;
    }
    results.missions_24h = breakdown;
    results.missions_24h_total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  } catch {
    results.missions_24h = 'error';
  }

  // Error rate
  const total = (results.missions_24h_total as number) ?? 0;
  const failed = ((results.missions_24h as Record<string, number>)?.failed) ?? 0;
  results.error_rate_24h = total > 0 ? `${((failed / total) * 100).toFixed(1)}%` : '0%';

  // API usage (last 24h)
  try {
    const { data: usage } = await db
      .from('raas_api_usage')
      .select('mcu_consumed, status_code')
      .gte('created_at', since);

    const rows = (usage ?? []) as Array<{ mcu_consumed: number; status_code: number }>;
    results.api_calls_24h = rows.length;
    results.mcu_consumed_24h = rows.reduce((s, r) => s + (r.mcu_consumed ?? 0), 0);
    results.api_errors_24h = rows.filter((r) => r.status_code >= 400).length;
  } catch {
    results.api_calls_24h = 'error';
  }

  // SLA assessment
  const errorRate = total > 0 ? (failed / total) * 100 : 0;
  const apiErrors = typeof results.api_errors_24h === 'number' ? results.api_errors_24h : 0;
  const apiCalls = typeof results.api_calls_24h === 'number' ? results.api_calls_24h : 0;
  const apiErrorRate = apiCalls > 0 ? (apiErrors / apiCalls) * 100 : 0;

  const sla = {
    mission_error_rate: { value: `${errorRate.toFixed(1)}%`, threshold: '< 5%', ok: errorRate < 5 },
    api_error_rate: { value: `${apiErrorRate.toFixed(1)}%`, threshold: '< 2%', ok: apiErrorRate < 2 },
    missions_24h: { value: total, threshold: '> 0 (system active)', ok: total > 0 },
    status: errorRate < 5 && apiErrorRate < 2 ? 'SLA_MET' : 'SLA_BREACH',
  };

  return NextResponse.json({
    status: 'deep_check_complete',
    timestamp: new Date().toISOString(),
    sla,
    ...results,
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
