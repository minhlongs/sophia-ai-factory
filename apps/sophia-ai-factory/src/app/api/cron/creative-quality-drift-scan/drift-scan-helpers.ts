/**
 * Query and alert evaluation helpers for /api/cron/creative-quality-drift-scan
 *
 * @module app/api/cron/creative-quality-drift-scan/drift-scan-helpers
 */

import type { getD1Safe } from '@/seed/db/client';
import { isAlertThrottled, markAlertThrottled } from '@/forest/alerts/alert-throttle';
import { triggerCreativeQualityDriftAlert } from '@/forest/alerts/creative-quality-drift-alert';

export const CRON_NAME = 'creative-quality-drift-scan';
export const IDEMPOTENCY_WINDOW_MS = 55 * 60 * 1000; // 55m (cron runs hourly)
export const ALERT_THROTTLE_TTL = 4 * 60 * 60; // 4 hours in KV seconds
export const ACCEPTANCE_DRIFT_THRESHOLD = 0.7; // 30% drop from baseline
export const MIN_EVENTS_FOR_ALERT = 5; // minimum events in current hour to alert

export type D1Binding = NonNullable<Awaited<ReturnType<typeof getD1Safe>>>;

export interface QualityRow {
  workspace_id: string;
  accepted_1h: number;
  rejected_1h: number;
  baseline_accepted_hourly: number;
  baseline_rejected_hourly: number;
}

export async function queryQualityDriftRows(
  db: D1Binding,
  now: number,
): Promise<QualityRow[]> {
  const hourAgo = now - 60 * 60 * 1000;
  const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
  const baselineHours = (7 * 24 * 60 * 60 * 1000) / 3600000; // 168 hours

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
     HAVING (accepted_1h + rejected_1h) > 0`,
  );
  const { results } = await stmt
    .bind(
      hourAgo,
      hourAgo,
      eightDaysAgo,
      hourAgo,
      baselineHours,
      eightDaysAgo,
      hourAgo,
      baselineHours,
      eightDaysAgo,
    )
    .all<QualityRow>();

  return (results ?? []) as QualityRow[];
}

export async function evaluateAndDispatchDriftAlerts(
  rows: QualityRow[],
): Promise<{ alerted: number; throttled: number }> {
  let alerted = 0;
  let throttled = 0;

  for (const row of rows) {
    const currentTotal = row.accepted_1h + row.rejected_1h;
    if (currentTotal < MIN_EVENTS_FOR_ALERT) continue;

    const currentRate = row.accepted_1h / currentTotal;
    const baselineTotal = row.baseline_accepted_hourly + row.baseline_rejected_hourly;
    if (baselineTotal <= 0) continue;

    const baselineRate = row.baseline_accepted_hourly / baselineTotal;
    const driftRatio = baselineRate > 0 ? currentRate / baselineRate : 1.0;

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

  return { alerted, throttled };
}
