/**
 * Public Affiliate Leaderboard API
 *
 * GET /api/affiliate/leaderboard
 * Optional query parameter: ?period=YYYY-MM
 * Returns Top 10 monthly affiliate rankings, prize pool, and updated timestamp.
 *
 * @module app/api/affiliate/leaderboard/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMonthlyLeaderboard } from '@/land/affiliates/leaderboard-service';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { LEADERBOARD_BONUS_POOL } from '@/seed/types/affiliate-expansion-types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get('period');

  // Validate period parameter format (YYYY-MM)
  if (periodParam && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodParam)) {
    return NextResponse.json(
      { error: 'Invalid period parameter format. Expected YYYY-MM (e.g. 2026-09).' },
      { status: 400 }
    );
  }

  const period = periodParam || new Date().toISOString().slice(0, 7);

  try {
    const d1 = await getD1();
    if (!d1) throw new Error('D1 database binding not available');
    const summary = await getMonthlyLeaderboard(d1, period);

    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    logger.error('[api/affiliate/leaderboard] Failed to fetch leaderboard', toError(error), {
      period,
    });

    return NextResponse.json(
      {
        period,
        totalPrizePoolUsd: LEADERBOARD_BONUS_POOL.TOTAL_POOL_USD,
        topAffiliates: [],
        updatedAt: new Date().toISOString(),
        error: 'Temporarily unable to query leaderboard',
      },
      { status: 500 }
    );
  }
}
