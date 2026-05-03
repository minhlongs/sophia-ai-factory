/**
 * GET /api/v1/dashboard/mission-control
 * Returns tier, quota, last 7d API call sparkline, and smart CTA hint.
 * @module app/api/v1/dashboard/mission-control/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import { TIER_MCU_LIMITS } from '@/lib/handover/handover-types';

export const dynamic = 'force-dynamic';

interface DayCountRow {
  date: string;
  count: number;
}

interface UsedRow {
  total: number;
}

const CtaHint = z.enum(['explore_sops', 'upgrade', 'renew']);
type CtaHint = z.infer<typeof CtaHint>;

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const tier = await getUserTier(user.id);
    const quotaTotal = TIER_MCU_LIMITS[tier] ?? 1000;

    // Quota used: sum of MCU events last 30d
    const usedRow = await db
      .prepare(
        `SELECT COALESCE(SUM(amount),0) as total FROM mcu_ledger
         WHERE user_id = ?1 AND type = 'debit'
           AND created_at >= strftime('%s','now','-30 days')`,
      )
      .bind(user.id)
      .first<UsedRow>()
      .catch(() => null);

    const quotaUsed = usedRow?.total ?? 0;

    // Last 7d daily API call counts from sop_runs
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const dayCounts = await db
      .prepare(
        `SELECT date(created_at, 'unixepoch') as date, COUNT(*) as count
         FROM sop_runs r
         JOIN user_sop_installations i ON r.installation_id = i.id
         WHERE i.user_id = ?1 AND r.created_at >= ?2
         GROUP BY date(created_at, 'unixepoch')
         ORDER BY date ASC`,
      )
      .bind(user.id, sevenDaysAgo)
      .all<DayCountRow>()
      .catch(() => ({ results: [] as DayCountRow[] }));

    // Build 7d array
    const countMap = new Map<string, number>(
      (dayCounts.results ?? []).map(r => [r.date, r.count]),
    );
    const last7d = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().slice(0, 10);
      return { date: dateStr, count: countMap.get(dateStr) ?? 0 };
    });

    const weeklyTotal = last7d.reduce((a, b) => a + b.count, 0);
    const quotaPct = quotaTotal > 0 ? quotaUsed / quotaTotal : 0;

    let ctaHint: CtaHint = 'explore_sops';
    if (quotaPct > 0.95) ctaHint = 'upgrade';
    else if (tier === 'BASIC' && weeklyTotal < 5) ctaHint = 'explore_sops';

    return NextResponse.json({
      tier,
      quota: { used: quotaUsed, total: quotaTotal, label: 'MCU credits' },
      last7d,
      ctaHint,
    });
  } catch (err) {
    logger.error('[MissionControl] Aggregator failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
