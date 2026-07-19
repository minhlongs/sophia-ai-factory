/**
 * GET /api/analytics/revenue
 *
 * Revenue snapshot — NOWPayments IPN + raas_licenses source.
 * Returns ARR, MRR, MRR growth %, per-tier breakdown, 30d trend.
 *
 * Query params:
 *   period  — '30d' | '90d' | '12m'  (default: '30d')
 *   org_id  — cross-tenant filter    (admin only)
 *
 * RBAC:
 *   Admin / MASTER — full data, org_id filter allowed
 *   ENTERPRISE     — own aggregates only
 *   BASIC/PREMIUM  — 403 (revenue is ENTERPRISE+ feature)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { checkAdmin, canAccessRevenue } from '@/land/analytics/rbac';
import { fetchRevenueSnapshot } from '@/land/analytics/queries/revenue-nowpayments';
import { logger } from '@/seed/utils/logger-utility';


// ── Zod schema ──────────────────────────────────────────────────────────────

const revenueQuerySchema = z.object({
  period: z.enum(['30d', '90d', '12m']).default('30d'),
  org_id: z.string().optional(),
});

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Auth
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 },
      );
    }

    // Validate query params
    const searchParams = request.nextUrl.searchParams;
    const validation = revenueQuerySchema.safeParse({
      period: searchParams.get('period') ?? undefined,
      org_id: searchParams.get('org_id') ?? undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { period, org_id } = validation.data;

    // RBAC
    const [userTier, isAdmin] = await Promise.all([
      resolveUserTier(user.id),
      checkAdmin(user.id),
    ]);

    if (!canAccessRevenue(userTier, isAdmin)) {
      return NextResponse.json(
        { error: 'Access denied - revenue metrics require ENTERPRISE tier or admin role' },
        { status: 403 },
      );
    }

    // org_id cross-tenant filter is admin-only
    if (org_id && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied - org_id filter is admin only' },
        { status: 403 },
      );
    }

    logger.info('[Analytics Revenue] Querying snapshot', {
      userId: user.id,
      userTier,
      isAdmin,
      period,
      org_id,
    });

    // Fetch snapshot
    const snapshot = await fetchRevenueSnapshot(period, org_id);

    return NextResponse.json({
      ...snapshot,
      metadata: {
        queriedAt: new Date().toISOString(),
        period,
        isAdmin,
      },
    });

  } catch (error) {
    logger.error(
      '[Analytics Revenue] Critical error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { error: 'Failed to query revenue data' },
      { status: 500 },
    );
  }
}
