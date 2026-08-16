/**
 * GET /api/admin/tenants/[id]/costs?month=YYYY-MM
 *
 * Admin-only. Aggregates video_cost_log by stage for a tenant.
 * Returns per-stage cost breakdown for the requested month.
 *
 * Requires Better Auth session with role=admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

interface CostRow {
  stage: string;
  provider: string;
  total_usd: number;
  entry_count: number;
}

function parseMonthParam(raw: string | null): { startSec: number; endSec: number } | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    startSec: Math.floor(start.getTime() / 1000),
    endSec: Math.floor(end.getTime() / 1000),
  };
}

function getD1(): D1Database | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;
  return (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id: tenantId } = await params;

  const monthParam = request.nextUrl.searchParams.get('month');
  const range = parseMonthParam(monthParam);

  if (!range) {
    return NextResponse.json(
      { error: 'Invalid or missing month parameter. Use YYYY-MM format.' },
      { status: 400 }
    );
  }

  const db = getD1();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const res = await db
      .prepare(
        `SELECT
           vcl.stage,
           vcl.provider,
           ROUND(SUM(vcl.cost_usd), 6) AS total_usd,
           COUNT(*) AS entry_count
         FROM video_cost_log vcl
         JOIN video_jobs vj ON vj.id = vcl.job_id
         WHERE vj.tenant_id = ?1
           AND vcl.recorded_at >= ?2
           AND vcl.recorded_at < ?3
         GROUP BY vcl.stage, vcl.provider
         ORDER BY total_usd DESC`
      )
      .bind(tenantId, range.startSec, range.endSec)
      .all<CostRow>();

    const rows = res.results ?? [];
    const totalUsd = rows.reduce((acc, r) => acc + r.total_usd, 0);

    return NextResponse.json({
      tenantId,
      month: monthParam,
      totalUsd: Math.round(totalUsd * 1_000_000) / 1_000_000,
      breakdown: rows,
    });
  } catch (err) {
    logger.error('[Admin/Costs] Query error', { tenantId, err: toError(err).message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
