/**
 * POST /api/analytics/export
 *
 * Export analytics data to CSV
 *
 * Body:
 * - start: number (Unix timestamp)
 * - end: number (Unix timestamp)
 * - licenseNonce?: string
 * - format: 'csv' | 'json'
 *
 * RBAC:
 * - BASIC: No export access
 * - PREMIUM+: Can export own data
 * - Admin: Can export any data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import { exportUsageToCsv } from '@/lib/analytics/export';
import { checkAdmin, canExport } from '@/lib/analytics/rbac';

interface AnalyticsExportPayload {
  start?: number;
  end?: number;
  licenseNonce?: string;
  format?: 'csv' | 'json';
}

export async function POST(request: NextRequest) {
  try {
    // Step 1: Authenticate user
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    // Step 2: Check export access
    const isAdmin = await checkAdmin(user.id);
    const userTier = await getUserTier(user.id);

    if (!canExport(userTier, isAdmin)) {
      return NextResponse.json(
        { error: 'Export requires PREMIUM tier or higher' },
        { status: 403 }
      );
    }

    // Step 3: Parse request body
    const body = (await request.json().catch(() => ({}))) as AnalyticsExportPayload;
    const { start, end, licenseNonce, format = 'csv' } = body;

    if (!start || !end) {
      return NextResponse.json(
        { error: 'start and end timestamps are required' },
        { status: 400 }
      );
    }

    // Validate date range (max 90 days)
    const dateRangeDays = (end - start) / 86400;
    if (dateRangeDays > 90) {
      return NextResponse.json(
        { error: 'Date range exceeds maximum of 90 days' },
        { status: 400 }
      );
    }

    // Step 4: RBAC - Determine license_nonce
    let queryLicenseNonce = licenseNonce;

    if (!isAdmin && !queryLicenseNonce) {
      // Auto-inject user's own license for non-admin
      const { getUserLicenseNonce } = await import('@/lib/analytics/rbac');
      queryLicenseNonce = await getUserLicenseNonce(user.id) || undefined;
    }

    logger.info('[Analytics Export] Starting export', {
      userId: user.id,
      userTier,
      isAdmin,
      start,
      end,
      licenseNonce: queryLicenseNonce,
      format,
    });

    // Step 5: Export data
    const result = await exportUsageToCsv({
      userId: user.id,
      licenseNonce: queryLicenseNonce,
      startTimestamp: start,
      endTimestamp: end,
      isAdmin,
    });

    // Step 6: Return response based on format
    if (format === 'csv') {
      return new Response(result.csv, {
        headers: {
          'Content-Type': 'text/csv;charset=utf-8;',
          'Content-Disposition': `attachment; filename="${result.filename}"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      data: result.csv,
      filename: result.filename,
      rowCount: result.rowCount,
    });

  } catch (error) {
    logger.error('[Analytics Export] Critical error', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export data' },
      { status: 500 }
    );
  }
}
