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
import { getCurrentUser } from '@/lib/better-auth-session';
import { getUserTier } from '@/lib/db/get-user-tier';
import { logger } from '@/lib/utils/logger-utility';
import { fetchRevenueMetrics } from '@/lib/analytics/queries';
import { checkAdmin, canAccessRevenue } from '@/lib/analytics/rbac';
import { analyticsRevenueQuerySchema } from '@/lib/validation/services';
import type { RevenuePeriod } from '@/lib/analytics/types';

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

    // Step 2: Parse query params with Zod schema
    const searchParams = request.nextUrl.searchParams;
    const validation = analyticsRevenueQuerySchema.safeParse({
      period: searchParams.get('period'),
      tier: searchParams.get('tier'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { period, tier } = validation.data;

    // Step 3: RBAC - Check if user is admin
    const isAdmin = await checkAdmin(user.id);
    const userTier = await getUserTier(user.id);

    // Check revenue access
    if (!canAccessRevenue(userTier, isAdmin)) {
      return NextResponse.json(
        { error: 'Access denied - revenue metrics require ENTERPRISE tier or higher' },
        { status: 403 }
      );
    }

    if (tier && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied - tier filter is admin-only' },
        { status: 403 }
      );
    }

    logger.info('[Analytics Revenue] Querying revenue metrics', {
      userId: user.id,
      userTier,
      isAdmin,
      period,
      tier,
    });

    // Step 4: Fetch revenue metrics
    const metrics = await fetchRevenueMetrics(period);

    // Step 5: Apply tier filter if requested (admin only)
    if (tier && isAdmin) {
      metrics.byTier = metrics.byTier.filter(t => t.tier === tier);
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
        tier,
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
