/**
 * Daily Rollup Cron Endpoint
 *
 * Triggered by Vercel Cron to aggregate hourly summaries into daily summaries
 *
 * Schedule: At 01:05 UTC every day (0 1 * * *)
 * See: vercel.json for cron configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyRollup } from '@/lib/usage-metering/rollup-service';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Verify cron authentication
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');

  // Allow bypass in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Check for cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecret === expectedSecret) {
    return true;
  }

  // Check for Vercel cron header
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron === 'true') {
    return true;
  }

  logger.warn('[Daily Rollup Cron] Unauthorized cron attempt');
  return false;
}

export async function GET(request: NextRequest) {
  // Verify authentication
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Get optional day_timestamp from query (for manual reprocessing)
    const searchParams = request.nextUrl.searchParams;
    const dayTimestampParam = searchParams.get('day_timestamp');
    const dayTimestamp = dayTimestampParam ? parseInt(dayTimestampParam, 10) : undefined;

    logger.info('[Daily Rollup Cron] Starting', {
      dayTimestamp: dayTimestamp ?? 'auto (yesterday)',
    });

    // Run rollup
    const result = await runDailyRollup(dayTimestamp);

    if (result.success) {
      logger.info('[Daily Rollup Cron] Complete', {
        processed: result.processed,
      });

      return NextResponse.json({
        success: true,
        processed: result.processed,
        message: `Successfully processed ${result.processed} tenant daily summaries`,
      });
    } else {
      const errorMessage = result.error || 'Unknown error';
      logger.error('[Daily Rollup Cron] Failed', new Error(errorMessage));

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Daily Rollup Cron] Critical error', new Error(errorMessage));

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - same as GET for compatibility
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
