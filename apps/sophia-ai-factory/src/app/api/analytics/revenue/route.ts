/**
 * GET /api/analytics/revenue
 *
 * Revenue metrics from Polar.sh subscriptions
 *
 * Query Params:
 * - period - 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days' (default: 'current_month')
 * - tier - Filter by tier (optional, admin only)
 *
 * RBAC:
 * - Admin: Can access all revenue data, filter by tier
 * - Customer: Only see aggregate data (no tier filter allowed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/utils/logger-utility';
import { fetchRevenueMetrics } from '@/lib/analytics/queries';
import { checkAdmin, canAccessRevenue } from '@/lib/analytics/rbac';
import type { RevenuePeriod } from '@/lib/analytics/types';

const VALID_PERIODS: RevenuePeriod[] = [
  'current_month',
  'last_month',
  'last_7_days',
  'last_30_days',
];

const VALID_TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

export async function GET(request: NextRequest) {
  try {
    // Step 1: Get authenticated user
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    // Step 2: Parse query params
    const searchParams = request.nextUrl.searchParams;
    const periodParam = searchParams.get('period') as RevenuePeriod | null;
    const tierParam = searchParams.get('tier');

    // Validate period
    const period: RevenuePeriod = periodParam && VALID_PERIODS.includes(periodParam)
      ? periodParam
      : 'current_month';

    if (periodParam && !VALID_PERIODS.includes(periodParam)) {
      return NextResponse.json(
        {
          error: `Invalid period - must be one of: ${VALID_PERIODS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate tier filter
    if (tierParam && !VALID_TIERS.includes(tierParam)) {
      return NextResponse.json(
        {
          error: `Invalid tier - must be one of: ${VALID_TIERS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Step 3: RBAC - Check if user is admin
    const isAdmin = await checkAdmin(user.id);

    // Check revenue access
    if (!canAccessRevenue(user.tier, isAdmin)) {
      return NextResponse.json(
        { error: 'Access denied - revenue metrics require ENTERPRISE tier or higher' },
        { status: 403 }
      );
    }

    if (tierParam && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied - tier filter is admin-only' },
        { status: 403 }
      );
    }

    logger.info('[Analytics Revenue] Querying revenue metrics', {
      userId: user.id,
      userTier: user.tier,
      isAdmin,
      period,
      tier: tierParam,
    });

    // Step 4: Fetch revenue metrics
    const metrics = await fetchRevenueMetrics(period);

    // Step 5: Apply tier filter if requested (admin only)
    if (tierParam && isAdmin) {
      metrics.byTier = metrics.byTier.filter(t => t.tier === tierParam);
      // Note: We don't filter the trend data as it's aggregated across all tiers
    }

    logger.info('[Analytics Revenue] Query complete', {
      totalRevenue: metrics.totalRevenue,
      recurringRevenue: metrics.recurringRevenue,
      byTierCount: metrics.byTier.length,
    });

    return NextResponse.json({
      ...metrics,
      metadata: {
        queriedAt: new Date().toISOString(),
        period,
        tier: tierParam,
      },
    });

  } catch (error) {
    logger.error('[Analytics Revenue] Critical error', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: 'Failed to query revenue data' },
      { status: 500 }
    );
  }
}
