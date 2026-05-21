/**
 * Clearance Promote Cron Endpoint
 *
 * Daily cron that promotes affiliate_conversions from 'pending_clearance'
 * to 'available' once the 60-day hold window has passed.
 *
 * Schedule: "0 0 * * *" — daily at midnight UTC
 * Auth: Authorization: Bearer <CRON_SECRET> | x-cron-secret header | token param
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'clearance-promote';
/** Daily — skip if ran within last 12 hours */
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

function getD1Binding(): D1Database {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.DB) return env.DB as D1Database;
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;
  throw new Error('D1 database binding not available');
}


interface RunResult {
  changes?: number;
}

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);

  let db: D1Database;
  try {
    db = getD1Binding();
  } catch {
    failCronCheckIn(cronCtx, CRON_NAME, new Error('D1 unavailable'));
    return NextResponse.json({ error: 'D1 unavailable' }, { status: 500 });
  }

  if (await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  try {
    const result = await db
      .prepare(
        `UPDATE affiliate_conversions
         SET payout_status = 'available'
         WHERE payout_status = 'pending_clearance'
           AND available_at IS NOT NULL
           AND available_at <= unixepoch()`
      )
      .run() as RunResult;

    const promoted = result.changes ?? 0;
    logger.info('[cron/clearance-promote] Done', { promoted });
    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, promoted });
  } catch (error) {
    const msg = toError(error).message;
    await recordCronRun(db, CRON_NAME, 'failure', msg);
    logger.error('[cron/clearance-promote] Failed', toError(error));
    failCronCheckIn(cronCtx, CRON_NAME, error);
    return NextResponse.json({ error: 'Clearance promote failed' }, { status: 500 });
  }
}
