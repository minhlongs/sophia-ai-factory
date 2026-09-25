/**
 * SLA Degradation Scan Cron — /api/cron/sla-degradation-scan
 *
 * Scans active enterprise GPU reservations every 15 minutes, evaluates
 * SLI metrics against SLA ceilings (99.9% uptime, 1500ms P95 latency),
 * records degradation incidents, and disburses automatic dual-rail
 * compensation (MCU credits or USDT refunds).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Schedule: every 15 minutes (slash-15 * * * *)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Safe } from '@/seed/db/client';
import { runSlaRefundMonitorScan } from '@/forest/jobs/sla-refund-monitor-cron';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'sla-degradation-scan';
const IDEMPOTENCY_WINDOW_MS = 14 * 60 * 1000; // 14m (cron runs every 15m)

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const checkInCtx = startCronCheckIn(CRON_NAME);
  const db = await getD1Safe();
  if (!db) {
    logger.error(`[cron/${CRON_NAME}] D1 binding unavailable`);
    failCronCheckIn(checkInCtx, CRON_NAME, new Error('D1 unavailable'));
    return NextResponse.json({ error: 'D1 binding unavailable' }, { status: 503 });
  }

  // Idempotency guard — skip if ran within window
  const skip = await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS);
  if (skip) {
    finishCronCheckIn(checkInCtx, CRON_NAME);
    return NextResponse.json({ status: 'skipped', reason: 'already-ran' });
  }

  const startTime = Date.now();
  try {
    const summary = await runSlaRefundMonitorScan(db);

    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(checkInCtx, CRON_NAME);

    const durationMs = Date.now() - startTime;
    return NextResponse.json({
      status: 'ok',
      durationMs,
      summary,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[cron/${CRON_NAME}] scan failed`, { error: error.message });
    await recordCronRun(db, CRON_NAME, 'failure', error.message);
    failCronCheckIn(checkInCtx, CRON_NAME, error);
    return NextResponse.json(
      { error: 'SLA degradation scan failed', message: error.message },
      { status: 500 },
    );
  }
}
