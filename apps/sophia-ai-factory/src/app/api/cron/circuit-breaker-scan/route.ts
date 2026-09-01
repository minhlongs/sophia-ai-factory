/**
 * Circuit Breaker Scan Cron — /api/cron/circuit-breaker-scan
 *
 * P3.C.5: Scans circuit_breaker_state for OPEN/HALF_OPEN services and fires
 * a platform alert (throttled via KV) when a service is not CLOSED.
 *
 * Reads D1 directly (cron isolate has cold memory cache — getState() is empty).
 * Alert recipient = synthetic-monitor user (platform-level).
 * Throttle: 1 alert per service per 15m window (KV key: cb_alert:<service>).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Schedule: every 15 minutes (wrangler cron: slash-15 minutes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Safe } from '@/seed/db/client';
import { isAlertThrottled, markAlertThrottled } from '@/forest/alerts/alert-throttle';
import { triggerCircuitBreakerOpenAlert } from '@/forest/alerts/circuit-breaker-alert';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'circuit-breaker-scan';
const IDEMPOTENCY_WINDOW_MS = 14 * 60 * 1000; // 14m (cron runs every 15m)
const ALERT_THROTTLE_TTL = 15 * 60; // 15 minutes in KV seconds

interface CircuitRow {
  service: string;
  key_ref: string;
  state: string;
  failure_count: number;
}

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

  // Idempotency guard — skip if already ran within window.
  const skip = await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS);
  if (skip) {
    finishCronCheckIn(checkInCtx, CRON_NAME);
    return NextResponse.json({ status: 'skipped', reason: 'already-ran' });
  }

  let openCount = 0;
  let alerted = 0;
  try {
    const stmt = db.prepare(
      `SELECT service, key_ref, state, failure_count
       FROM circuit_breaker_state
       WHERE state IN ('OPEN', 'HALF_OPEN')`
    );
    const { results } = await stmt.all<CircuitRow>();
    const rows = (results ?? []) as CircuitRow[];
    openCount = rows.length;

    for (const row of rows) {
      const throttleKey = `cb_alert:${row.service}:${row.key_ref}`;
      if (await isAlertThrottled(throttleKey)) continue;

      const alertId = await triggerCircuitBreakerOpenAlert({
        service: row.service,
        keyRef: row.key_ref,
        failureCount: row.failure_count,
        state: row.state,
      });
      if (alertId) {
        await markAlertThrottled(throttleKey, alertId, ALERT_THROTTLE_TTL);
        alerted += 1;
      }
    }

    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(checkInCtx, CRON_NAME);
    return NextResponse.json({ status: 'ok', openCount, alerted });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[cron/${CRON_NAME}] scan failed`, { error: error.message });
    await recordCronRun(db, CRON_NAME, 'failure', error.message);
    failCronCheckIn(checkInCtx, CRON_NAME, error);
    return NextResponse.json({ error: 'scan failed', openCount, alerted }, { status: 500 });
  }
}
