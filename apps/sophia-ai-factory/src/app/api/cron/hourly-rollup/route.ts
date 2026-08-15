/**
 * Hourly Rollup Cron Endpoint
 *
 * Triggered by Cloudflare Cron Trigger to aggregate usage events into hourly summaries
 *
 * Schedule: At minute 5 past every hour (5 * * * *)
 * See: wrangler.toml for cron configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { runHourlyRollup } from '@/tree/usage-metering/rollup-service';
import { logger } from '@/seed/utils/logger-utility';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

const CRON_NAME = 'hourly-rollup';
/** Hourly — skip if ran within last 30 minutes */
const IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000;

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const db = getD1();

  if (db && await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const hourTimestampParam = searchParams.get('hour_timestamp');
    const hourTimestamp = hourTimestampParam ? parseInt(hourTimestampParam, 10) : undefined;

    logger.info('[Hourly Rollup Cron] Starting', {
      hourTimestamp: hourTimestamp ?? 'auto (previous hour)',
    });

    const result = await runHourlyRollup(hourTimestamp);

    if (result.success) {
      logger.info('[Hourly Rollup Cron] Complete', { processed: result.processed });
      if (db) await recordCronRun(db, CRON_NAME, 'success');
      finishCronCheckIn(cronCtx, CRON_NAME);
      return NextResponse.json({
        success: true,
        processed: result.processed,
        message: `Successfully processed ${result.processed} tenant summaries`,
      });
    } else {
      const errorMessage = result.error || 'Unknown error';
      logger.error('[Hourly Rollup Cron] Failed', new Error(errorMessage));
      if (db) await recordCronRun(db, CRON_NAME, 'failure', errorMessage);
      failCronCheckIn(cronCtx, CRON_NAME, new Error(errorMessage));
      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Hourly Rollup Cron] Critical error', new Error(errorMessage));
    if (db) await recordCronRun(db, CRON_NAME, 'failure', errorMessage);
    failCronCheckIn(cronCtx, CRON_NAME, error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
