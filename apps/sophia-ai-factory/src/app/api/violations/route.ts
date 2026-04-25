/**
 * GET /api/violations
 *
 * Fetch violation events with filtering and pagination.
 *
 * Query Params:
 * - licenseNonce, userId, type, severity, start, end, resolved, page, limit
 *
 * Auth: JWT Bearer token OR X-API-Key header
 * RBAC: Admin → any nonce; Customer → own nonce only
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';
import { fetchViolations, fetchViolationSummary } from '@/lib/analytics/queries';
import { violationsQuerySchema } from '@/lib/validation/services';
import type { ViolationFilters } from '@/lib/analytics/types';
import { authenticateRequest, applyRbac } from './violations-auth';

const MAX_DATE_RANGE_DAYS = 90;

export async function GET(request: NextRequest) {
  try {
    // Step 1: Authenticate
    const authOutcome = await authenticateRequest(request);
    if (authOutcome.error) return authOutcome.error;
    const { userId, userTier, isAdmin } = authOutcome.auth;

    // Step 2: Parse & validate query params
    const sp = request.nextUrl.searchParams;
    const validation = violationsQuerySchema.safeParse({
      licenseNonce: sp.get('licenseNonce'),
      userId: sp.get('userId'),
      type: sp.get('type'),
      severity: sp.get('severity'),
      start: sp.get('start'),
      end: sp.get('end'),
      resolved: sp.get('resolved'),
      page: sp.get('page'),
      limit: sp.get('limit'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { licenseNonce, userId: filterUserId, type, severity, start, end, resolved, page: pageStr, limit: limitStr } = validation.data;
    const page = pageStr || 1;
    const limit = Math.min(limitStr || 50, 100);

    if (start && end) {
      if ((end - start) / 86400 > MAX_DATE_RANGE_DAYS) {
        return NextResponse.json({ error: `Date range exceeds maximum of ${MAX_DATE_RANGE_DAYS} days` }, { status: 400 });
      }
      if (start > end) {
        return NextResponse.json({ error: 'start must be before end' }, { status: 400 });
      }
    }

    // Step 3: RBAC
    const rbac = await applyRbac(userId, isAdmin, licenseNonce, filterUserId);
    if (rbac.error) return rbac.error;
    const { queryLicenseNonce } = rbac;

    logger.info('[Violations API] Querying violation events', {
      userId, userTier, isAdmin,
      licenseNonce: queryLicenseNonce,
      filters: { type, severity, resolved },
      page, limit,
    });

    // Step 4: Build filters & fetch
    const filters: ViolationFilters = {
      licenseNonce: queryLicenseNonce,
      userId: isAdmin && filterUserId ? filterUserId : userId,
      type, severity,
      startTimestamp: start,
      endTimestamp: end,
      resolved,
    };

    const result = await fetchViolations(filters, page, limit);

    const now = Math.floor(Date.now() / 1000);
    const summary = await fetchViolationSummary(filters, now - 86400, now);

    logger.info('[Violations API] Query complete', {
      total: result.total,
      returned: result.violations.length,
      hasMore: result.hasMore,
    });

    return NextResponse.json({
      violations: result.violations,
      pagination: { page, limit, total: result.total, hasMore: result.hasMore },
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
        filters: { ...filters, page, limit },
      },
    });

  } catch (error) {
    logger.error('[Violations API] Critical error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to query violation data' }, { status: 500 });
  }
}
