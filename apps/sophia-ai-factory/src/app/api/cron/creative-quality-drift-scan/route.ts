/**
 * Creative Quality Drift Scan Cron — /api/cron/creative-quality-drift-scan
 *
 * P3.C.9: Detects creative acceptance rate drift per workspace from
 * performance_events (creative.accepted / creative.rejected).
 * Fires platform alerts (throttled via KV).
 *
 * Alert recipient = synthetic-monitor user (platform-level).
 * Throttle: 1 alert per workspace per 4h (KV key: quality_drift_alert:<workspaceId>).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Schedule: hourly at minute 0 (wrangler cron: "0 * * * *")
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Safe } from '@/seed/db/client';
import {
  CRON_NAME,
  IDEMPOTENCY_WINDOW_MS,
  evaluateAndDispatchDriftAlerts,
  queryQualityDriftRows,
} from './drift-scan-helpers';

export const dynamic = 'force-dynamic';

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

  const skip = await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS);
  if (skip) {
    finishCronCheckIn(checkInCtx, CRON_NAME);
    return NextResponse.json({ status: 'skipped', reason: 'already-ran' });
  }

  let scanned = 0;
  let alerted = 0;
  let throttled = 0;
  try {
    const rows = await queryQualityDriftRows(db, Date.now());
    scanned = rows.length;

    const counts = await evaluateAndDispatchDriftAlerts(rows);
    alerted = counts.alerted;
    throttled = counts.throttled;

    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(checkInCtx, CRON_NAME);
    return NextResponse.json({ status: 'ok', scanned, alerted, throttled });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[cron/${CRON_NAME}] scan failed`, { error: error.message });
    await recordCronRun(db, CRON_NAME, 'failure', error.message);
    failCronCheckIn(checkInCtx, CRON_NAME, error);
    return NextResponse.json({ error: 'scan failed', scanned, alerted, throttled }, { status: 500 });
  }
}
