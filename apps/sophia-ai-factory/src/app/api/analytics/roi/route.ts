/**
 * GET /api/analytics/roi
 *
 * Calculate ROI metrics for a specific license
 *
 * Query Params:
 * - licenseNonce - License nonce to calculate ROI for (required)
 * - valuePerCredit - Value per credit in USD (optional, default: 0.01)
 *
 * RBAC:
 * - User can only view ROI for licenses they own
 * - Admin can view any license ROI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/utils/logger-utility';
import { calculateRoiMetrics } from '@/lib/analytics/roi-calculator';
import { verifyLicenseAccess, checkAdmin } from '@/lib/analytics/rbac';

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
    const licenseNonce = searchParams.get('licenseNonce');
    const valuePerCreditParam = searchParams.get('valuePerCredit');

    if (!licenseNonce) {
      return NextResponse.json(
        { error: 'Missing required parameter: licenseNonce' },
        { status: 400 }
      );
    }

    // Parse and validate valuePerCredit
    const valuePerCredit = valuePerCreditParam
      ? parseFloat(valuePerCreditParam)
      : 0.01;

    if (isNaN(valuePerCredit) || valuePerCredit <= 0) {
      return NextResponse.json(
        { error: 'Invalid valuePerCredit - must be a positive number' },
        { status: 400 }
      );
    }

    // Step 3: RBAC - Verify user has access to this license
    const isAdmin = await checkAdmin(user.id);
    const access = await verifyLicenseAccess(user.id, licenseNonce, isAdmin);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error || 'Access denied' },
        { status: 403 }
      );
    }

    logger.info('[Analytics ROI] Calculating ROI metrics', {
      userId: user.id,
      userTier: user.tier,
      isAdmin,
      licenseNonce,
      valuePerCredit,
    });

    // Step 4: Calculate ROI metrics
    const metrics = await calculateRoiMetrics(licenseNonce, valuePerCredit);

    logger.info('[Analytics ROI] Calculation complete', {
      licenseNonce,
      roiPercent: metrics.roiPercent,
      paybackMonths: metrics.paybackMonths,
      projectedAnnual: metrics.projectedAnnual,
    });

    return NextResponse.json({
      licenseNonce,
      metrics,
      metadata: {
        valuePerCredit,
        calculatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('[Analytics ROI] Critical error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof Error && error.message === 'License not found') {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to calculate ROI metrics' },
      { status: 500 }
    );
  }
}
