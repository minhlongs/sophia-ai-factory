/**
 * GET /api/analytics/tier-adoption
 *
 * Returns daily tier subscription counts for admin analytics.
 * Queries raas_licenses grouped by tier and date.
 *
 * Query params:
 *   from  — ISO date YYYY-MM-DD (required)
 *   to    — ISO date YYYY-MM-DD (required)
 *
 * RBAC: Admin-only (MASTER tier or admin role)
 *
 * Edge runtime compatible (Cloudflare Workers).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { checkAdmin } from '@/land/analytics/rbac';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { TierAdoptionPoint, TierAdoptionChartRow, TierAdoptionData } from '@/seed/types/analytics-tier';
import type { Tier } from '@/seed/types';


// ── Validation ──────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = z.object({
  from: z.string().regex(ISO_DATE_RE, 'Must be YYYY-MM-DD'),
  to: z.string().regex(ISO_DATE_RE, 'Must be YYYY-MM-DD'),
});

// ── D1 row type ─────────────────────────────────────────────────────────────

interface LicenseRow {
  date: string;
  tier: string;
  new_count: number;
  total_count: number;
}

// ── Pivot helper ────────────────────────────────────────────────────────────

const TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

function pivotToChartRows(points: TierAdoptionPoint[]): TierAdoptionChartRow[] {
  const dateMap = new Map<string, TierAdoptionChartRow>();

  for (const p of points) {
    if (!dateMap.has(p.date)) {
      dateMap.set(p.date, { date: p.date, BASIC: 0, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0 });
    }
    const row = dateMap.get(p.date)!;
    if (TIERS.includes(p.tier)) {
      row[p.tier] = p.totalActive;
    }
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 },
      );
    }

    // Admin-only
    const isAdmin = await checkAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 },
      );
    }

    // Validate query params
    const sp = request.nextUrl.searchParams;
    const validation = querySchema.safeParse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { from, to } = validation.data;

    if (from > to) {
      return NextResponse.json(
        { error: 'Invalid date range: from must be before or equal to to' },
        { status: 400 },
      );
    }

    logger.info('[Analytics TierAdoption] Querying', { userId: user.id, from, to });

    // Query D1: daily new + total active per tier
    const db = createServerClient();

    // New subscriptions per day per tier
    const { data: newRows, error: newErr } = await (db as ReturnType<typeof createServerClient>)
      .from('raas_licenses')
      .select('tier, created_at')
      .gte('created_at', `${from}T00:00:00Z`)
      .lte('created_at', `${to}T23:59:59Z`)
      .eq('is_revoked', false) as { data: { tier: string; created_at: string }[] | null; error: unknown };

    if (newErr) {
      logger.error('[Analytics TierAdoption] DB error', new Error(String(newErr)));
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    // All active licenses up to `to` for cumulative totals
    const { data: allRows } = await (db as ReturnType<typeof createServerClient>)
      .from('raas_licenses')
      .select('tier, created_at')
      .lte('created_at', `${to}T23:59:59Z`)
      .eq('is_revoked', false) as { data: { tier: string; created_at: string }[] | null; error: unknown };

    // Build daily new counts map: date → tier → count
    const newMap = new Map<string, Map<Tier, number>>();
    for (const row of (newRows ?? [])) {
      const date = row.created_at.slice(0, 10);
      if (!newMap.has(date)) newMap.set(date, new Map());
      const tierMap = newMap.get(date)!;
      const tier = row.tier as Tier;
      tierMap.set(tier, (tierMap.get(tier) ?? 0) + 1);
    }

    // Build cumulative total per tier up to each date
    // Collect all dates in range
    const dates: string[] = [];
    const cur = new Date(from);
    const end = new Date(to);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    // Compute cumulative totals per tier for each date
    const points: TierAdoptionPoint[] = [];

    for (const tier of TIERS) {
      // Count total active up to the start of range
      const preCount = (allRows ?? []).filter(r => {
        return r.tier === tier && r.created_at.slice(0, 10) < from;
      }).length;

      let running = preCount;

      for (const date of dates) {
        const dayNew = newMap.get(date)?.get(tier) ?? 0;
        running += dayNew;

        if (dayNew > 0 || running > 0) {
          points.push({
            date,
            tier,
            newSubscriptions: dayNew,
            totalActive: running,
          });
        }
      }
    }

    const chartRows = pivotToChartRows(points);

    const result: TierAdoptionData = {
      points,
      chartRows,
      period: { from, to },
    };

    return NextResponse.json(result);

  } catch (error) {
    logger.error(
      '[Analytics TierAdoption] Critical error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
