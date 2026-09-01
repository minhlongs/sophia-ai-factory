/**
 * Mission Abandon Scan Cron — /api/cron/mission-abandon-scan
 *
 * P3.C.7: Counts mission.abandoned events in the trailing 1h window from
 * performance_events. Fires a platform alert (throttled via KV) when the
 * count exceeds 5x the 7-day hourly baseline.
 *
 * Alert recipient = synthetic-monitor user (platform-wide SLO breach).
 * Throttle: 1 alert per 2h (KV key: abandon_alert:global).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Schedule: every 30 minutes (wrangler cron: slash-30 minutes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Safe } from '@/seed/db/client';
import { isAlertThrottled, markAlertThrottled } from '@/forest/alerts/alert-throttle';
import { triggerMissionAbandonSpikeAlert } from '@/forest/alerts/mission-abandon-alert';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'mission-abandon-scan';
const IDEMPOTENCY_WINDOW_MS = 29 * 60 * 1000; // 29m (cron runs every 30m)
const ALERT_THROTTLE_TTL = 2 * 60 * 60; // 2 hours in KV seconds
const ABANDON_MULTIPLIER = 5;
const TRAILING_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const BASELINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface AbandonCount {
  window_count: number;
  baseline_hourly: number;
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

  const skip = await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS);
  if (skip) {
    finishCronCheckIn(checkInCtx, CRON_NAME);
    return NextResponse.json({ status: 'skipped', reason: 'already-ran' });
  }

  try {
    const now = Date.now();
    const windowStart = now - TRAILING_WINDOW_MS;
    const baselineStart = now - BASELINE_WINDOW_MS;

    // Count mission.abandoned events in trailing 1h and 7-day hourly baseline.
    const stmt = db.prepare(
      `SELECT
         SUM(CASE WHEN recorded_at >= ? THEN 1 ELSE 0 END) AS window_count,
         CAST(SUM(CASE WHEN recorded_at >= ? AND recorded_at < ? THEN 1 ELSE 0 END) AS REAL)
           / (? / 3600000.0) AS baseline_hourly
       FROM performance_events
       WHERE event_type = 'mission.abandoned'
         AND recorded_at >= ?`
    );
    const baselineHours = BASELINE_WINDOW_MS / 3600000;
    const { results } = await stmt.bind(windowStart, baselineStart, windowStart, baselineHours, baselineStart).all<AbandonCount>();
    const row = (results?.[0] ?? { window_count: 0, baseline_hourly: 0 }) as AbandonCount;

    const windowCount = row.window_count ?? 0;
    const baselineHourly = row.baseline_hourly ?? 0;

    let alerted = 0;
    let throttled = false;
    if (baselineHourly > 0 && windowCount >= baselineHourly * ABANDON_MULTIPLIER) {
      const throttleKey = 'abandon_alert:global';
      if (await isAlertThrottled(throttleKey)) {
        throttled = true;
      } else {
        const multiplier = windowCount / baselineHourly;
        const alertId = await triggerMissionAbandonSpikeAlert({
          windowAbandons: windowCount,
          baselineAbandons: Math.round(baselineHourly),
          multiplier: Math.round(multiplier * 100) / 100,
          windowMs: TRAILING_WINDOW_MS,
        });
        if (alertId) {
          await markAlertThrottled(throttleKey, alertId, ALERT_THROTTLE_TTL);
          alerted = 1;
        }
      }
    }

    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(checkInCtx, CRON_NAME);
    return NextResponse.json({
      status: 'ok',
      windowCount,
      baselineHourly: Math.round(baselineHourly * 100) / 100,
      alerted,
      throttled,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[cron/${CRON_NAME}] scan failed`, { error: error.message });
    await recordCronRun(db, CRON_NAME, 'failure', error.message);
    failCronCheckIn(checkInCtx, CRON_NAME, error);
    return NextResponse.json({ error: 'scan failed' }, { status: 500 });
  }
}
