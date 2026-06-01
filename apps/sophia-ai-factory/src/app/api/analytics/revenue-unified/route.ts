/**
 * GET /api/analytics/revenue-unified
 *
 * Unified revenue by vertical (saas / crypto / product) aggregated by day.
 * Admin or ENTERPRISE/MASTER only.
 *
 * Query params:
 *   period — '7d' | '30d' | '90d'  (default: '30d')
 *
 * Response: UnifiedRevenueSummary
 *
 * Cache-Control: private, max-age=300 (5 min)
 *
 * @module app/api/analytics/revenue-unified
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { checkAdmin, canAccessRevenue } from '@/land/analytics/rbac';
import { fetchUnifiedRevenue } from '@/land/analytics/queries/revenue-unified-query';
import { logger } from '@/seed/utils/logger-utility';


// ── Zod schema ────────────────────────────────────────────────────────────────

const querySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
});

const periodToDays: Record<'7d' | '30d' | '90d', 7 | 30 | 90> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Auth
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate query params
    const params = request.nextUrl.searchParams;
    const validation = querySchema.safeParse({
      period: params.get('period') ?? undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid period', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    // RBAC — same gate as /api/analytics/revenue
    const [userTier, isAdmin] = await Promise.all([
      getUserTier(user.id),
      checkAdmin(user.id),
    ]);

    if (!canAccessRevenue(userTier, isAdmin)) {
      return NextResponse.json(
        { error: 'Forbidden — ENTERPRISE tier or admin required' },
        { status: 403 },
      );
    }

    const { period } = validation.data;
    const days = periodToDays[period];

    logger.info('[Revenue Unified] Fetching', { userId: user.id, period, days });

    const data = await fetchUnifiedRevenue(days);

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (err) {
    logger.error(
      '[Revenue Unified] Error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json({ error: 'Failed to fetch unified revenue' }, { status: 500 });
  }
}
