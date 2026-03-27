/**
 * Hourly Rollup Cron Endpoint
 *
 * Triggered by Cloudflare Cron Trigger to aggregate usage events into hourly summaries
 *
 * Schedule: At minute 5 past every hour (0 * * * *)
 * See: wrangler.toml for cron configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { runHourlyRollup } from '@/lib/usage-metering/rollup-service';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Verify cron authentication
 *
 * Cloudflare Cron sends Authorization: Bearer <token> header
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

  // Check for Cloudflare cron header
  const cfCron = request.headers.get('x-cf-cron');
  if (cfCron === 'true') {
    return true;
  }

  logger.warn('[Hourly Rollup Cron] Unauthorized cron attempt');
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
    // Get optional hour_timestamp from query (for manual reprocessing)
    const searchParams = request.nextUrl.searchParams;
    const hourTimestampParam = searchParams.get('hour_timestamp');
    const hourTimestamp = hourTimestampParam ? parseInt(hourTimestampParam, 10) : undefined;

    logger.info('[Hourly Rollup Cron] Starting', {
      hourTimestamp: hourTimestamp ?? 'auto (previous hour)',
    });

    // Run rollup
    const result = await runHourlyRollup(hourTimestamp);

    if (result.success) {
      logger.info('[Hourly Rollup Cron] Complete', {
        processed: result.processed,
      });

      return NextResponse.json({
        success: true,
        processed: result.processed,
        message: `Successfully processed ${result.processed} tenant summaries`,
      });
    } else {
      const errorMessage = result.error || 'Unknown error';
      logger.error('[Hourly Rollup Cron] Failed', new Error(errorMessage));

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
    logger.error('[Hourly Rollup Cron] Critical error', new Error(errorMessage));

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
