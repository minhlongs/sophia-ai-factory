/**
 * Daily rollup cron — aggregates 5-min status_check into status_day_rollup, purges old.
 * Schedule: 00:05 UTC daily (uses existing "0 0 * * *" slot)
 * @module app/api/cron/status-rollup/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'status-rollup';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;
  return handleRollup(req);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

async function handleRollup(req: NextRequest) { // eslint-disable-line @typescript-eslint/no-unused-vars

  const cronCtx = startCronCheckIn(CRON_NAME);
  const db = getD1();
  if (!db) {
    failCronCheckIn(cronCtx, CRON_NAME, new Error('D1 not available'));
    return NextResponse.json({ ok: false, error: 'D1 not available' }, { status: 503 });
  }

  try {
    // Aggregate yesterday's checks into rollup
    await db.prepare(`
      INSERT OR REPLACE INTO status_day_rollup (date, total_checks, ok_checks, p99_ms)
      SELECT
        date(ts, 'unixepoch') as date,
        COUNT(*) as total_checks,
        SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) as ok_checks,
        NULL as p99_ms
      FROM status_check
      WHERE date(ts, 'unixepoch') = date('now', '-1 day')
      GROUP BY date(ts, 'unixepoch')
    `).run();

    // Purge status_check rows older than 30 days
    const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;
    const purge = await db
      .prepare(`DELETE FROM status_check WHERE ts < ?1`)
      .bind(cutoff)
      .run();

    logger.info('[status-rollup] Complete', { purged: purge.meta?.changes ?? 0 });
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, purged: purge.meta?.changes ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[status-rollup] Failed', err instanceof Error ? err : new Error(msg));
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
