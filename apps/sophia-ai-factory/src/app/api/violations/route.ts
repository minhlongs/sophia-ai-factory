/**
 * GET /api/violations
 *
 * Fetch violation events with filtering and pagination
 *
 * Query Params:
 * - licenseNonce (optional) - Filter by license
 * - userId (optional) - Filter by user ID
 * - type (optional) - Violation type: quota_exceeded, invalid_license, etc.
 * - severity (optional) - Severity level: low, medium, high, critical
 * - start (optional) - Unix timestamp start
 * - end (optional) - Unix timestamp end
 * - resolved (optional) - Filter by resolved status (true/false)
 * - page (optional) - Page number (default: 1)
 * - limit (optional) - Items per page (default: 50, max: 100)
 *
 * RBAC:
 * - Admin: Can query any licenseNonce or global (omit param)
 * - Customer: Only own licenseNonce (auto-injected if missing)
 *
 * Authentication:
 * - JWT via Authorization: Bearer <token>
 * - OR mk_ API key via X-API-Key header
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/utils/logger-utility';
import { fetchViolations, fetchViolationSummary } from '@/lib/analytics/queries';
import { verifyLicenseAccess, getUserLicenseNonce, checkAdmin } from '@/lib/analytics/rbac';
import { violationsQuerySchema } from '@/lib/validation/services';
import { validateApiKey } from '@/lib/security/api-key-validator';
import { validateJwt } from '@/lib/security/jwt-validator';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import type { ViolationFilters } from '@/lib/analytics/types';

// Maximum date range for queries (90 days)
const MAX_DATE_RANGE_DAYS = 90;

export async function GET(request: NextRequest) {
  try {
    // Step 1: Authenticate user (JWT or API Key)
    let userId: string | null = null;
    let userTier: string | null = null;
    let isAdmin = false;
    let apiKeyId: string | null = null;

    // Try JWT first
    const authHeader = request.headers.get('authorization');
    const jwtResult = await validateJwt(authHeader);

    if (jwtResult.valid && jwtResult.payload) {
      userId = jwtResult.payload.sub;
      const user = await getCurrentUser();
      if (user) {
        userTier = user.tier;
        isAdmin = await checkAdmin(user.id);

        // Check rate limit for JWT users (100 requests per minute default)
        const rateLimitResult = await checkRateLimit(user.id, 100);
        if (!rateLimitResult.allowed) {
          return NextResponse.json(
            {
              error: 'Rate limit exceeded',
              retryAfter: rateLimitResult.retryAfter,
            },
            { status: 429 }
          );
        }
      }
    } else {
      // Try API key
      const apiKey = request.headers.get('x-api-key');
      const apiKeyResult = await validateApiKey(apiKey);

      if (apiKeyResult.valid && apiKeyResult.apiKey) {
        userId = apiKeyResult.apiKey.ownerId;
        userTier = 'PREMIUM'; // Default tier for API key users
        apiKeyId = apiKeyResult.apiKey.keyId;

        // Check rate limit for API key
        const rateLimitResult = await checkRateLimit(
          apiKeyId,
          apiKeyResult.apiKey.rateLimitPerMinute
        );

        if (!rateLimitResult.allowed) {
          return NextResponse.json(
            {
              error: 'Rate limit exceeded',
              retryAfter: rateLimitResult.retryAfter,
            },
            { status: 429 }
          );
        }
      }
    }

    // Require authentication
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required (JWT Bearer token or X-API-Key)' },
        { status: 401 }
      );
    }

    // Step 2: Parse query params with Zod schema
    const searchParams = request.nextUrl.searchParams;
    const validation = violationsQuerySchema.safeParse({
      licenseNonce: searchParams.get('licenseNonce'),
      userId: searchParams.get('userId'),
      type: searchParams.get('type'),
      severity: searchParams.get('severity'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      resolved: searchParams.get('resolved'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      licenseNonce,
      userId: filterUserId,
      type,
      severity,
      start,
      end,
      resolved,
      page: pageStr,
      limit: limitStr,
    } = validation.data;

    const page = pageStr || 1;
    const limit = Math.min(limitStr || 50, 100); // Cap at 100

    // Validate date range if both start and end provided
    if (start && end) {
      const dateRangeDays = (end - start) / 86400;
      if (dateRangeDays > MAX_DATE_RANGE_DAYS) {
        return NextResponse.json(
          { error: `Date range exceeds maximum of ${MAX_DATE_RANGE_DAYS} days` },
          { status: 400 }
        );
      }
      if (start > end) {
        return NextResponse.json(
          { error: 'start must be before end' },
          { status: 400 }
        );
      }
    }

    // Step 3: RBAC - Determine what user can query
    let queryLicenseNonce: string | undefined = licenseNonce;

    if (!isAdmin) {
      // Customer users can only see their own violations
      if (filterUserId && filterUserId !== userId) {
        return NextResponse.json(
          { error: 'Access denied - can only query own violations' },
          { status: 403 }
        );
      }

      if (licenseNonce) {
        // Verify the license belongs to this user
        const access = await verifyLicenseAccess(userId, licenseNonce, false);
        if (!access.allowed) {
          return NextResponse.json(
            { error: access.error || 'Access denied' },
            { status: 403 }
          );
        }
      } else {
        // Auto-inject user's own license nonce if not provided
        queryLicenseNonce = await getUserLicenseNonce(userId) || undefined;
      }
    }

    logger.info('[Violations API] Querying violation events', {
      userId,
      userTier,
      isAdmin,
      licenseNonce: queryLicenseNonce,
      filters: { type, severity, resolved },
      page,
      limit,
    });

    // Step 4: Build filters
    const filters: ViolationFilters = {
      licenseNonce: queryLicenseNonce,
      userId: isAdmin && filterUserId ? filterUserId : userId,
      type,
      severity,
      startTimestamp: start,
      endTimestamp: end,
      resolved,
    };

    // Step 5: Fetch violations
    const result = await fetchViolations(filters, page, limit);

    // Step 6: Fetch summary for metadata
    const now = Math.floor(Date.now() / 1000);
    const last24Hours = now - (24 * 3600);
    const summary = await fetchViolationSummary(filters, last24Hours, now);

    logger.info('[Violations API] Query complete', {
      total: result.total,
      returned: result.violations.length,
      hasMore: result.hasMore,
    });

    return NextResponse.json({
      violations: result.violations,
      pagination: {
        page,
        limit,
        total: result.total,
        hasMore: result.hasMore,
      },
      summary: {
        totalViolations: summary.totalViolations,
        byType: summary.byType,
        bySeverity: summary.bySeverity,
        byTier: summary.byTier,
        resolvedCount: summary.resolvedCount,
        unresolvedCount: summary.unresolvedCount,
      },
      metadata: {
        queriedAt: new Date().toISOString(),
        queriedBy: userId,
        filters: {
          ...filters,
          page,
          limit,
        },
      },
    });

  } catch (error) {
    logger.error('[Violations API] Critical error', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: 'Failed to query violation data' },
      { status: 500 }
    );
  }
}
