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
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/utils/logger-utility';
import { fetchUsageMetrics } from '@/lib/analytics/queries';
import { verifyLicenseAccess, getUserLicenseNonce, checkAdmin } from '@/lib/analytics/rbac';
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

    // Step 2: Parse query params
    const searchParams = request.nextUrl.searchParams;
    const licenseNonce = searchParams.get('license_nonce');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const granularity = searchParams.get('granularity') as AnalyticsGranularity || 'hour';
    const service = searchParams.get('service') as AiService || undefined;

    // Validate granularity
    if (!['hour', 'day'].includes(granularity)) {
      return NextResponse.json(
        { error: 'Invalid granularity - must be "hour" or "day"' },
        { status: 400 }
      );
    }

    // Validate service
    if (service && !['heygen', 'elevenlabs', 'openrouter'].includes(service)) {
      return NextResponse.json(
        { error: 'Invalid service - must be "heygen", "elevenlabs", or "openrouter"' },
        { status: 400 }
      );
    }

    // Step 3: Parse timestamps
    const now = Math.floor(Date.now() / 1000);
    let startTimestamp: number;
    let endTimestamp: number = now;

    if (startParam) {
      startTimestamp = parseInt(startParam, 10);
      if (isNaN(startTimestamp)) {
        return NextResponse.json(
          { error: 'Invalid start timestamp - must be Unix seconds' },
          { status: 400 }
        );
      }
    } else {
      // Default to last 24 hours
      startTimestamp = now - (24 * 3600);
    }

    if (endParam) {
      endTimestamp = parseInt(endParam, 10);
      if (isNaN(endTimestamp)) {
        return NextResponse.json(
          { error: 'Invalid end timestamp - must be Unix seconds' },
          { status: 400 }
        );
      }
    }

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

    // Step 4: RBAC - Determine license_nonce to query
    let queryLicenseNonce: string | undefined = licenseNonce || undefined;

    // Check if user is admin
    const isAdmin = await checkAdmin(user.id);

    if (!isAdmin) {
      // Customer users can only see their own data
      if (licenseNonce) {
        // Verify the license belongs to this user
        const access = await verifyLicenseAccess(user.id, licenseNonce, isAdmin);
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
      userTier: user.tier,
      isAdmin,
      licenseNonce: queryLicenseNonce,
      startTimestamp,
      endTimestamp,
      granularity,
      service,
    });

    // Step 5: Fetch usage metrics
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
