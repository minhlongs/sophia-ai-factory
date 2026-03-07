/**
 * GET /api/analytics/licenses
 *
 * License utilization metrics
 *
 * Query Params:
 * - status - 'active' | 'expired' | 'revoked' | 'all' (default: 'active')
 * - tier - Filter by tier (optional)
 *
 * RBAC:
 * - Admin: Can query all licenses, filter by status/tier
 * - Customer: Only see own license utilization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/utils/logger-utility';
import { fetchLicenseMetrics } from '@/lib/analytics/queries';
import { checkAdmin, verifyLicenseAccess, getUserLicenseNonce } from '@/lib/analytics/rbac';
import type { LicenseStatus, LicenseFilters } from '@/lib/analytics/types';

const VALID_STATUSES: LicenseStatus[] = ['active', 'expired', 'revoked', 'all'];
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
    const statusParam = searchParams.get('status') as LicenseStatus | null;
    const tierParam = searchParams.get('tier');
    const licenseNonceParam = searchParams.get('license_nonce');

    // Validate status
    const status: LicenseStatus = statusParam && VALID_STATUSES.includes(statusParam)
      ? statusParam
      : 'active';

    if (statusParam && !VALID_STATUSES.includes(statusParam)) {
      return NextResponse.json(
        {
          error: `Invalid status - must be one of: ${VALID_STATUSES.join(', ')}`,
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

    // Step 3: RBAC - Determine access level
    const isAdmin = await checkAdmin(user.id);

    logger.info('[Analytics Licenses] Querying license metrics', {
      userId: user.id,
      userTier: user.tier,
      isAdmin,
      status,
      tier: tierParam,
      licenseNonce: licenseNonceParam,
    });

    // Step 4: Handle customer vs admin access
    const filters: LicenseFilters = {};

    if (!isAdmin) {
      // Customer users can only see their own license
      if (licenseNonceParam) {
        // Verify the license belongs to this user
        const access = await verifyLicenseAccess(user.id, licenseNonceParam, isAdmin);
        if (!access.allowed) {
          return NextResponse.json(
            { error: access.error || 'Access denied' },
            { status: 403 }
          );
        }
      } else {
        // Auto-inject user's own license nonce
        const userNonce = await getUserLicenseNonce(user.id);
        if (userNonce) {
          filters.status = status;
          // Query will be filtered by user's license in the data layer
        }
      }
      filters.status = status;
    } else {
      // Admin users can filter by status and tier
      filters.status = status;
      if (tierParam) {
        filters.tier = tierParam;
      }
    }

    // Step 5: Fetch license metrics
    const metrics = await fetchLicenseMetrics(filters);

    // Step 6: For non-admin users, filter utilization to only their licenses
    if (!isAdmin) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      // Get all licenses owned by this user
      const { data: userLicenses } = await supabase
        .from('raas_licenses')
        .select('nonce')
        .eq('created_by', user.id) as any;

      const userNonces = new Set(userLicenses?.map((l: any) => l.nonce) || []);

      // Filter utilization to only user's licenses
      metrics.utilization = metrics.utilization.filter(
        u => userNonces.has(u.licenseNonce)
      );

      // Recalculate total and byTier
      metrics.total = metrics.utilization.length;
      const newByTier: Record<string, number> = {};
      for (const u of metrics.utilization) {
        newByTier[u.tier] = (newByTier[u.tier] || 0) + 1;
      }
      metrics.byTier = newByTier;
    }

    logger.info('[Analytics Licenses] Query complete', {
      total: metrics.total,
      byTier: Object.keys(metrics.byTier).length,
      utilizationCount: metrics.utilization.length,
    });

    return NextResponse.json({
      ...metrics,
      metadata: {
        queriedAt: new Date().toISOString(),
        status,
        tier: tierParam,
        isAdmin,
      },
    });

  } catch (error) {
    logger.error('[Analytics Licenses] Critical error', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: 'Failed to query license data' },
      { status: 500 }
    );
  }
}
