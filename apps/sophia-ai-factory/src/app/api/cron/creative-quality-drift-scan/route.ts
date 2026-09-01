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
import { isAlertThrottled, markAlertThrottled } from '@/forest/alerts/alert-throttle';
import { triggerCreativeQualityDriftAlert } from '@/forest/alerts/creative-quality-drift-alert';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'creative-quality-drift-scan';
const IDEMPOTENCY_WINDOW_MS = 55 * 60 * 1000; // 55m (cron runs hourly)
const ALERT_THROTTLE_TTL = 4 * 60 * 60; // 4 hours in KV seconds
const ACCEPTANCE_DRIFT_THRESHOLD = 0.7; // 30% drop from baseline
const MIN_EVENTS_FOR_ALERT = 5; // minimum events in current hour to alert

interface QualityRow {
  workspace_id: string;
  accepted_1h: number;
  rejected_1h: number;
  baseline_accepted_hourly: number;
  baseline_rejected_hourly: number;
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

  let scanned = 0;
  let alerted = 0;
  let throttled = 0;
  try {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    const baselineHours = (7 * 24 * 60 * 60 * 1000) / 3600000; // 168 hours

    // Current hour acceptance rate vs 7-day hourly baseline
    const stmt = db.prepare(
      `SELECT
         workspace_id,
         SUM(CASE WHEN recorded_at >= ? AND event_type = 'creative.accepted' THEN 1 ELSE 0 END) AS accepted_1h,
         SUM(CASE WHEN recorded_at >= ? AND event_type = 'creative.rejected' THEN 1 ELSE 0 END) AS rejected_1h,
         CAST(SUM(CASE WHEN recorded_at >= ? AND recorded_at < ? AND event_type = 'creative.accepted' THEN 1 ELSE 0 END) AS REAL)
           / ? AS baseline_accepted_hourly,
         CAST(SUM(CASE WHEN recorded_at >= ? AND recorded_at < ? AND event_type = 'creative.rejected' THEN 1 ELSE 0 END) AS REAL)
           / ? AS baseline_rejected_hourly
       FROM performance_events
       WHERE recorded_at >= ?
         AND event_type IN ('creative.accepted', 'creative.rejected')
       GROUP BY workspace_id
       HAVING (accepted_1h + rejected_1h) > 0`
    );
    const { results } = await stmt.bind(
      hourAgo,      // accepted_1h floor
      hourAgo,      // rejected_1h floor
      eightDaysAgo, // baseline start (accepted)
      hourAgo,      // baseline end (accepted)
      baselineHours, // baseline hours divisor (accepted)
      eightDaysAgo, // baseline start (rejected)
      hourAgo,      // baseline end (rejected)
      baselineHours, // baseline hours divisor (rejected)
      eightDaysAgo  // WHERE floor
    ).all<QualityRow>();
    const rows = (results ?? []) as QualityRow[];

    scanned = rows.length;

    for (const row of rows) {
      const currentTotal = row.accepted_1h + row.rejected_1h;
      if (currentTotal < MIN_EVENTS_FOR_ALERT) continue; // insufficient samples

      const currentRate = row.accepted_1h / currentTotal;
      const baselineTotal = row.baseline_accepted_hourly + row.baseline_rejected_hourly;
      if (baselineTotal <= 0) continue;

      const baselineRate = row.baseline_accepted_hourly / baselineTotal;
      const driftRatio = baselineRate > 0 ? currentRate / baselineRate : 1.0;

      // Check threshold: current rate < 70% of baseline rate
      if (driftRatio >= ACCEPTANCE_DRIFT_THRESHOLD) continue;

      const throttleKey = `quality_drift_alert:${row.workspace_id}`;
      if (await isAlertThrottled(throttleKey)) {
        throttled += 1;
        continue;
      }

      const alertId = await triggerCreativeQualityDriftAlert({
        workspaceId: row.workspace_id,
        currentAcceptanceRate: currentRate,
        baselineAcceptanceRate: baselineRate,
        driftRatio,
        acceptedCount: row.accepted_1h,
        rejectedCount: row.rejected_1h,
      });

      if (alertId) {
        await markAlertThrottled(throttleKey, alertId, ALERT_THROTTLE_TTL);
        alerted += 1;
      }
    }

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