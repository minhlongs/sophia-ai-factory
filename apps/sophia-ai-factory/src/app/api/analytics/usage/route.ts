/**
 * GET /api/analytics/usage
 *
 * Usage metrics with time-series data for analytics dashboard
 *
 * Query Params:
 * - license_nonce (optional) - Filter by license
 * - start (required) - Unix timestamp
 * - end (required) - Unix timestamp
 * - granularity - 'hour' | 'day' (default: 'hour')
 * - service - 'heygen' | 'elevenlabs' | 'openrouter' (optional)
 *
 * RBAC:
 * - Admin: Can query any license_nonce or global (omit param)
 * - Customer: Only own license_nonce (auto-injected if missing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import { fetchUsageMetrics } from '@/land/analytics/queries';
import type { UsageFilters, UsageMetrics } from '@/land/analytics/types';
import {
  emptyUsageMetrics,
  parseUsageQueryParams,
  resolveUsageQueryRbac,
} from './usage-route-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 },
      );
    }

    const parsed = parseUsageQueryParams(request.nextUrl.searchParams);
    if (!parsed.ok) return parsed.response;
    const { license_nonce, startTimestamp, endTimestamp, granularity, service } = parsed.data;

    const rbac = await resolveUsageQueryRbac(user.id, license_nonce);
    if (!rbac.ok) return rbac.response;
    const { isAdmin, queryLicenseNonce } = rbac;

    const userTier = await resolveUserTier(user.id);

    logger.info('[Analytics Usage] Querying usage metrics', {
      userId: user.id,
      userTier,
      isAdmin,
      licenseNonce: queryLicenseNonce,
      startTimestamp,
      endTimestamp,
      granularity,
      service,
    });

    // Step 4: Fetch usage metrics
    const filters: UsageFilters = {
      licenseNonce: queryLicenseNonce,
      startTimestamp,
      endTimestamp,
      granularity,
      service,
    };

    let metrics: UsageMetrics;
    try {
      metrics = await fetchUsageMetrics(filters);
    } catch (error) {
      logger.warn('[Analytics Usage] Returning empty metrics', {
        reason: error instanceof Error ? error.message : String(error),
      });
      metrics = emptyUsageMetrics();
    }

    logger.info('[Analytics Usage] Query complete', {
      totalRequests: metrics.summary.totalRequests,
      totalCredits: metrics.summary.totalCredits,
    });

    return NextResponse.json({
      ...metrics,
      metadata: {
        queriedAt: new Date().toISOString(),
        period: {
          start: startTimestamp,
          end: endTimestamp,
        },
        granularity,
        service,
      },
    });

  } catch (error) {
    logger.error('[Analytics Usage] Critical error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof Error && error.message.includes('Date range')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ...emptyUsageMetrics(),
      metadata: {
        queriedAt: new Date().toISOString(),
        period: null,
        granularity: 'hour',
        service: null,
      },
    });
  }
}
