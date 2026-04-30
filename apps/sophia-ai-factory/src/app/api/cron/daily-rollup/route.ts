/**
 * Daily Rollup Cron Endpoint
 *
 * Triggered by Cloudflare Cron Trigger to aggregate hourly summaries into daily summaries
 *
 * Schedule: At 01:05 UTC every day (0 1 * * *)
 * See: wrangler.toml for cron configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyRollup } from '@/lib/usage-metering/rollup-service';
import { logger } from '@/lib/utils/logger-utility';
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker';
import { verifyCronAuth } from '@/lib/security/cron-auth';

const CRON_NAME = 'daily-rollup';
/** Daily — skip if ran within last 12 hours */
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

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

  const db = getD1();

  if (db && await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const dayTimestampParam = searchParams.get('day_timestamp');
    const dayTimestamp = dayTimestampParam ? parseInt(dayTimestampParam, 10) : undefined;

    logger.info('[Daily Rollup Cron] Starting', {
      dayTimestamp: dayTimestamp ?? 'auto (yesterday)',
    });

    const result = await runDailyRollup(dayTimestamp);

    if (result.success) {
      logger.info('[Daily Rollup Cron] Complete', { processed: result.processed });
      if (db) await recordCronRun(db, CRON_NAME, 'success');
      return NextResponse.json({
        success: true,
        processed: result.processed,
        message: `Successfully processed ${result.processed} tenant daily summaries`,
      });
    } else {
      const errorMessage = result.error || 'Unknown error';
      logger.error('[Daily Rollup Cron] Failed', new Error(errorMessage));
      if (db) await recordCronRun(db, CRON_NAME, 'failure', errorMessage);
      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Daily Rollup Cron] Critical error', new Error(errorMessage));
    if (db) await recordCronRun(db, CRON_NAME, 'failure', errorMessage);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
