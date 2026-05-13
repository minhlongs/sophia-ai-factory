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
import { getUserTier } from '@/seed/db/get-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import { fetchUsageMetrics } from '@/lib/analytics/queries';
import { verifyLicenseAccess, getUserLicenseNonce, checkAdmin } from '@/lib/analytics/rbac';
import { analyticsUsageQuerySchema } from '@/lib/validation/services';
import type { UsageFilters, AnalyticsGranularity, AiService } from '@/lib/analytics/types';

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
    const validation = analyticsUsageQuerySchema.safeParse({
      license_nonce: searchParams.get('license_nonce'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      granularity: searchParams.get('granularity'),
      service: searchParams.get('service'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { license_nonce, start, end, granularity, service } = validation.data;

    // Handle NaN from transform
    if (!start || !end || isNaN(start) || isNaN(end)) {
      return NextResponse.json(
        { error: 'Invalid start/end timestamps - must be valid Unix seconds' },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const startTimestamp = start;
    const endTimestamp = end;

    // Validate date range
    if (startTimestamp > endTimestamp) {
      return NextResponse.json(
        { error: 'start must be before end' },
        { status: 400 }
      );
    }

    // Limit to 90 days max
    const maxRange = 90 * 86400;
    if (endTimestamp - startTimestamp > maxRange) {
      return NextResponse.json(
        { error: `Date range exceeds maximum of 90 days`, suggestion: 'Split into smaller ranges' },
        { status: 400 }
      );
    }

    // Step 3: RBAC - Determine license_nonce to query
    let queryLicenseNonce: string | undefined = license_nonce || undefined;

    // Check if user is admin
    const isAdmin = await checkAdmin(user.id);
    const userTier = await getUserTier(user.id);

    if (!isAdmin) {
      // Customer users can only see their own data
      if (license_nonce) {
        // Verify the license belongs to this user
        const access = await verifyLicenseAccess(user.id, license_nonce, isAdmin);
        if (!access.allowed) {
          return NextResponse.json(
            { error: access.error || 'Access denied' },
            { status: 403 }
          );
        }
      } else {
        // Auto-inject user's own license nonce if not provided
        queryLicenseNonce = await getUserLicenseNonce(user.id) || undefined;
      }
    }

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

    const metrics = await fetchUsageMetrics(filters);

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

    return NextResponse.json(
      { error: 'Failed to query usage data' },
      { status: 500 }
    );
  }
}
