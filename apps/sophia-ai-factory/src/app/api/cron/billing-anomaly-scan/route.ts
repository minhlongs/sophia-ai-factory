/**
 * Billing Anomaly Scan Cron — /api/cron/billing-anomaly-scan
 *
 * P3.C.6: Detects workspaces whose production spend (total_cost_cents from
 * production_graph_runs) in the trailing 24h exceeds 3x their 7-day daily
 * average baseline. Fires a per-workspace platform alert (throttled via KV).
 *
 * Alert recipient = workspace owner (tenant-facing).
 * Throttle: 1 alert per workspace per 6h (KV key: billing_alert:<workspaceId>).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Schedule: daily 07:00 UTC — "0 7 * * *"
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Safe } from '@/seed/db/client';
import { isAlertThrottled, markAlertThrottled } from '@/forest/alerts/alert-throttle';
import { triggerBillingAnomalyAlert } from '@/forest/alerts/billing-anomaly-alert';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'billing-anomaly-scan';
const IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000; // 23h (cron runs daily)
const ALERT_THROTTLE_TTL = 6 * 60 * 60; // 6 hours in KV seconds
const SPEND_MULTIPLIER = 3;

interface WorkspaceSpend {
  workspace_id: string;
  spend_24h_cents: number;
  baseline_daily_cents: number;
  owner_user_id: string;
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
  try {
    // Trailing 24h spend vs 7-day daily-average baseline.
    // production_graph_runs.total_cost_cents is the canonical spend source.
    // org_members resolves workspace owner (role='owner').
    const stmt = db.prepare(
      `SELECT
         r.workspace_id,
         COALESCE(SUM(CASE WHEN r.created_at >= ? THEN r.total_cost_cents ELSE 0 END), 0) AS spend_24h_cents,
         COALESCE(SUM(CASE WHEN r.created_at >= ? AND r.created_at < ? THEN r.total_cost_cents ELSE 0 END) / 7.0, 0) AS baseline_daily_cents,
         m.user_id AS owner_user_id
       FROM production_graph_runs r
       JOIN org_members m ON m.org_id = r.workspace_id AND m.role = 'owner'
       WHERE r.created_at >= ?
       GROUP BY r.workspace_id
       HAVING spend_24h_cents > 0`
    );
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    // Bind order mirrors the 4 SQL placeholders: spend_24h floor (dayAgo),
    // baseline_start (eightDaysAgo), baseline_end (dayAgo), WHERE floor (eightDaysAgo).
    const { results } = await stmt.bind(dayAgo, eightDaysAgo, dayAgo, eightDaysAgo).all<WorkspaceSpend>();
    const rows = (results ?? []) as WorkspaceSpend[];
    scanned = rows.length;

    for (const row of rows) {
      if (row.baseline_daily_cents <= 0) continue;
      if (row.spend_24h_cents < row.baseline_daily_cents * SPEND_MULTIPLIER) continue;

      const throttleKey = `billing_alert:${row.workspace_id}`;
      if (await isAlertThrottled(throttleKey)) continue;

      const multiplier = row.spend_24h_cents / row.baseline_daily_cents;
      const alertId = await triggerBillingAnomalyAlert({
        userId: row.owner_user_id,
        workspaceId: row.workspace_id,
        currentSpendCents: row.spend_24h_cents,
        baselineSpendCents: Math.round(row.baseline_daily_cents),
        multiplier: Math.round(multiplier * 100) / 100,
      });
      if (alertId) {
        await markAlertThrottled(throttleKey, alertId, ALERT_THROTTLE_TTL);
        alerted += 1;
      }
    }

    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(checkInCtx, CRON_NAME);
    return NextResponse.json({ status: 'ok', scanned, alerted });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[cron/${CRON_NAME}] scan failed`, { error: error.message });
    await recordCronRun(db, CRON_NAME, 'failure', error.message);
    failCronCheckIn(checkInCtx, CRON_NAME, error);
    return NextResponse.json({ error: 'scan failed', scanned, alerted }, { status: 500 });
  }
}
