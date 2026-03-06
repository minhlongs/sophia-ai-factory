/**
 * Usage Summary API
 *
 * GET /api/usage/summary - Get aggregated usage summary
 * Query params:
 *  - period: 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days' (default: 'current_month')
 *  - license_nonce: optional - specific license to query
 *
 * Authentication:
 *  - Supabase Auth (user must be logged in)
 *  - Users can only access their own usage
 *  - Admins can access all usage data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUsageSummaryForPeriod } from '@/lib/usage-metering/export';
import { logger } from '@/lib/utils/logger-utility';
import { z } from 'zod';

const summaryQuerySchema = z.object({
  period: z.enum(['current_month', 'last_month', 'last_7_days', 'last_30_days']).default('current_month'),
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
    const parseResult = summaryQuerySchema.safeParse({
      period: searchParams.get('period'),
      license_nonce: searchParams.get('license_nonce'),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { period, license_nonce } = parseResult.data;

    // Check admin status
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single() as any;

    const isAdmin = userData?.role === 'admin' || (user as any).user_metadata?.role === 'admin';

    // Verify license ownership if provided
    if (license_nonce && !isAdmin) {
      const { data: license } = await supabase
        .from('raas_licenses')
        .select('created_by')
        .eq('nonce', license_nonce)
        .single() as any;

      if (!license || license.created_by !== user.id) {
        return NextResponse.json({ error: 'Forbidden - not your license' }, { status: 403 });
      }
    }

    // Get usage summary
    const result = await getUsageSummaryForPeriod(
      license_nonce || user.id, // Use user ID as fallback for non-license queries
      period
    );

    logger.info('[Usage Summary API] Retrieved summary', {
      userId: user.id,
      period,
      totalCredits: result.totalCredits,
    });

    return NextResponse.json({
      period,
      startTimestamp: result.startTimestamp,
      endTimestamp: result.endTimestamp,
      summary: result.summary,
      totalCredits: result.totalCredits,
      hourly: result.hourly || [],
      daily: result.daily || [],
      metadata: {
        userId: user.id,
        isAdmin,
        licenseNonce: license_nonce || null,
        exportedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('[Usage Summary API] Error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to get usage summary' },
      { status: 500 }
    );
  }
}
