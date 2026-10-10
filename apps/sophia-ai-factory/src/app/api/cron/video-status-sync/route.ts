import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun } from '@/land/cron/run-tracker';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  CRON_NAME,
  TIMEOUT_MS,
  CONCURRENCY_LIMIT,
  type VideoRow,
  type SyncSummary,
  processSyncRow,
} from './modules';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const summary: SyncSummary = { checked: 0, terminal: 0, timedOut: 0, errors: 0 };

  let db: D1Database | null = null;
  try {
    db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
  } catch (err) {
    logger.error('[video-status-sync] D1 unavailable', err instanceof Error ? err : undefined);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ error: 'db_unavailable' }, { status: 500 });
  }

  try {
    const rows = await db
      .prepare(
        `SELECT id, user_id, heygen_job_id, created_at, purchase_id, locale, r2_key
         FROM videos
         WHERE status = 'processing'
         LIMIT 50`,
      )
      .all<VideoRow>();

    const pending = rows.results ?? [];
    summary.checked = pending.length;
    const cutoff = Date.now() - TIMEOUT_MS;

    for (let i = 0; i < pending.length; i += CONCURRENCY_LIMIT) {
      const chunk = pending.slice(i, i + CONCURRENCY_LIMIT);
      const results = await Promise.allSettled(
        chunk.map((row) => processSyncRow(db!, row, cutoff, summary)),
      );
      for (const r of results) {
        if (r.status === 'rejected') {
          summary.errors += 1;
          logger.error(
            '[video-status-sync] poll failed',
            r.reason instanceof Error ? r.reason : undefined,
          );
        }
      }
    }

    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (db) await recordCronRun(db, CRON_NAME, 'failure', msg);
    logger.error('[video-status-sync] fatal', err instanceof Error ? err : undefined);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 });
  }
}
