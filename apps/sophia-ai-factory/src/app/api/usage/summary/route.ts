/**
 * Usage Summary API
 *
 * GET /api/usage/summary - Get aggregated usage summary with overage detection
 * Query params:
 *  - period: 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days' (default: 'current_month')
 *  - license_nonce: optional - specific license to query
 *
 * Authentication:
 *  - Supabase Auth (user must be logged in)
 *  - Users can only access their own usage
 *  - Admins can access all usage data
 *
 * Returns:
 *  - Usage summary with hourly/daily/monthly usage
 *  - Overage detection and fees
 *  - Usage forecast predictions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { getUsageSummaryForPeriod } from '@/lib/usage-metering/export';
import {
  aggregateUsageForLicense,
  detectOverageEvents,
  predictUsageForecast,
  calculateOverageEstimate,
} from '@/lib/billing/usage-aggregator';
import { logger } from '@/seed/utils/logger-utility';
import { z } from 'zod';
import type { Tier } from '@/seed/types';

const summaryQuerySchema = z.object({
  period: z.enum(['current_month', 'last_month', 'last_7_days', 'last_30_days']).default('current_month'),
  license_nonce: z.string().optional(),
});

interface LicenseOwnerRow {
  created_by: string | null;
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = createServerClient();

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
    const isAdmin = await isUserAdmin(user);

    // Verify license ownership if provided
    if (license_nonce && !isAdmin) {
      const { data: rawLicense } = await supabase
        .from('raas_licenses')
        .select('created_by')
        .eq('nonce', license_nonce)
        .single();
      const license = rawLicense as LicenseOwnerRow | null;

      if (!license || license.created_by !== user.id) {
        return NextResponse.json({ error: 'Forbidden - not your license' }, { status: 403 });
      }
    }

    // If license_nonce provided, use new usage-aggregator for detailed summary
    if (license_nonce) {
      const summary = await aggregateUsageForLicense(license_nonce);

      if (!summary) {
        return NextResponse.json({ error: 'License not found' }, { status: 404 });
      }

      const overages = detectOverageEvents(summary);
      const forecast = predictUsageForecast(summary);
      const overageEstimate = calculateOverageEstimate(overages, summary.tier);

      logger.info('[Usage Summary API] Retrieved detailed summary', {
        userId: user.id,
        licenseNonce: license_nonce.slice(0, 8) + '...',
        status: summary.status,
      });

      return NextResponse.json({
        summary: {
          ...summary,
          licenseNonce: license_nonce.slice(0, 8) + '...',
        },
        overages: overages.map(o => ({
          ...o,
          overageFee: o.exceededBy * getOverageRate(summary.tier),
        })),
        forecast,
        overageEstimate: {
          total: Math.round(overageEstimate.totalEstimate * 100) / 100,
          breakdown: overageEstimate.breakdown.map(b => ({
            ...b,
            amount: Math.round(b.amount * 100) / 100,
          })),
        },
      });
    }

    // Fallback to existing getUsageSummaryForPeriod for period-based queries
    const result = await getUsageSummaryForPeriod(
      user.id,
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
        licenseNonce: null,
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

/**
 * Get overage rate by tier
 */
function getOverageRate(tier: Tier): number {
  const rates: Record<Tier, number> = {
    BASIC: 0.10,
    PREMIUM: 0.05,
    ENTERPRISE: 0.03,
    MASTER: 0.02,
  };
  return rates[tier] || rates.BASIC;
}
