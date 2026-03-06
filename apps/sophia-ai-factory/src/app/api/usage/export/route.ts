/**
 * Usage Export API
 *
 * GET /api/usage/export - Export usage data for billing/analytics
 * Query params:
 *  - start: Unix timestamp (seconds) - start of date range
 *  - end: Unix timestamp (seconds) - end of date range
 *  - format: 'json' | 'csv' (default: 'json')
 *  - service: 'heygen' | 'elevenlabs' | 'openrouter' (optional filter)
 *
 * Authentication:
 *  - Supabase Auth (user must be logged in)
 *  - Admin check: users can only access their own usage
 *  - Admins can access all usage data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exportUsage, generateCsv } from '@/lib/usage-metering/export';
import { logger } from '@/lib/utils/logger-utility';
import { z } from 'zod';

const exportQuerySchema = z.object({
  start: z.string().transform((val) => parseInt(val, 10)),
  end: z.string().transform((val) => parseInt(val, 10)),
  format: z.enum(['json', 'csv']).default('json'),
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']).optional(),
  license_nonce: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const parseResult = exportQuerySchema.safeParse({
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      format: searchParams.get('format'),
      service: searchParams.get('service'),
      license_nonce: searchParams.get('license_nonce'),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { start, end, format, service, license_nonce } = parseResult.data;

    // Validate date range
    const now = Math.floor(Date.now() / 1000);
    if (start > end) {
      return NextResponse.json({ error: 'start must be before end' }, { status: 400 });
    }
    if (start > now || end > now) {
      return NextResponse.json({ error: 'Date range cannot be in the future' }, { status: 400 });
    }
    // Max 90-day range for performance
    const maxRange = 90 * 86400;
    if (end - start > maxRange) {
      return NextResponse.json({
        error: `Date range exceeds maximum of ${maxRange} seconds (${Math.floor(maxRange/86400)} days)`,
        suggestion: 'Split your request into multiple smaller date ranges'
      }, { status: 400 });
    }

    // Check admin status
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single() as any;

    const isAdmin = userData?.role === 'admin' || (user as any).user_metadata?.role === 'admin';

    // Determine user ID and license nonce for query
    let userId = user.id;
    let queryLicenseNonce = license_nonce;

    // If license_nonce provided and user is admin, allow cross-user query
    if (license_nonce && !isAdmin) {
      // Verify ownership
      const { data: license } = await supabase
        .from('raas_licenses')
        .select('created_by')
        .eq('nonce', license_nonce)
        .single() as any;

      if (!license || license.created_by !== user.id) {
        return NextResponse.json({ error: 'Forbidden - not your license' }, { status: 403 });
      }
    }

    // Export usage
    const usageData = await exportUsage({
      userId: isAdmin && license_nonce ? undefined : userId,
      licenseNonce: queryLicenseNonce,
      startTimestamp: start,
      endTimestamp: end,
      service,
      format,
    });

    logger.info('[Usage Export API] Exported usage', {
      userId,
      isAdmin,
      format,
      service,
      eventCount: usageData.events.length,
    });

    // Return response based on format
    if (format === 'csv') {
      const csv = generateCsv(usageData.events);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="usage-export-${userId}-${start}-${end}.csv"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    return NextResponse.json({
      summary: usageData.summary,
      daily: usageData.daily,
      events: usageData.events,
      aggregated: usageData.aggregated,
      metadata: {
        userId: isAdmin ? 'all' : userId,
        licenseNonce: queryLicenseNonce || 'all',
        service: service || 'all',
        startTimestamp: start,
        endTimestamp: end,
        totalEvents: usageData.events.length,
        totalCredits: usageData.aggregated?.totalCredits || 0,
        totalRequests: usageData.aggregated?.totalRequests || 0,
        exportedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('[Usage Export API] Error exporting usage', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to export usage' },
      { status: 500 }
    );
  }
}
