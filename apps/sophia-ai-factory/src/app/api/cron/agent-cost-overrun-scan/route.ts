/**
 * Agent Cost Overrun Scan Cron — /api/cron/agent-cost-overrun-scan
 *
 * P3.C.10: Scans creative_missions for spend vs budget overruns and
 * runaway burn rates. Fires tenant alerts to workspace owners (throttled via KV).
 *
 * Alert recipient = workspace owner user_id (tenant-facing, customer money).
 * Throttle: 1 alert per mission per 2h (KV key: cost_overrun_alert:<missionId>).
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
import { triggerAgentCostOverrunAlert } from '@/forest/alerts/agent-cost-overrun-alert';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'agent-cost-overrun-scan';
const IDEMPOTENCY_WINDOW_MS = 14 * 60 * 1000; // 14m (cron runs every 15m)
const ALERT_THROTTLE_TTL = 2 * 60 * 60; // 2 hours in KV seconds
const WARN_THRESHOLD = 0.85; // 85% of budget
const CRITICAL_THRESHOLD = 1.0; // 100% of budget

interface MissionRow {
  mission_id: string;
  workspace_id: string;
  budget_cents: number;
  spent_cents: number;
  status: string;
  timeframe_end: number;
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
  let throttled = 0;
  try {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    // Get active missions with budget > 0 and spent > 0, join org_members for owner
    const stmt = db.prepare(
      `SELECT
         cm.id AS mission_id,
         cm.workspace_id,
         cm.budget_cents,
         cm.spent_cents,
         cm.status,
         cm.timeframe_end,
         m.user_id AS owner_user_id
       FROM creative_missions cm
       JOIN org_members m ON m.org_id = cm.workspace_id AND m.role = 'owner'
       WHERE cm.status IN ('active', 'executing')
         AND cm.budget_cents > 0
         AND cm.spent_cents > 0`
    );
    const { results } = await stmt.all<MissionRow>();
    const rows = (results ?? []) as MissionRow[];

    scanned = rows.length;

    for (const row of rows) {
      const spendPercent = row.spent_cents / row.budget_cents;
      const remainingMs = row.timeframe_end - now;
      const remainingHours = Math.max(1, remainingMs / 3600000);

      // Calculate hourly burn rate from last hour
      const burnStmt = db.prepare(
        `SELECT COALESCE(SUM(CAST(json_extract(payload, '$.costCents') AS INTEGER)), 0) AS hourly_burn
         FROM performance_events
         WHERE event_type = 'mission.cost_recorded'
           AND json_extract(payload, '$.missionId') = ?
           AND recorded_at >= ?`
      );
      const { results: burnResults } = await burnStmt.bind(row.mission_id, hourAgo).all<{ hourly_burn: number }>();
      const hourlyBurnRateCents = burnResults?.[0]?.hourly_burn ?? 0;

      // Projected total spend
      const projectedTotalCents = row.spent_cents + hourlyBurnRateCents * remainingHours;
      const projectedPercent = projectedTotalCents / row.budget_cents;

      // Determine severity
      let severity: 'high' | 'critical' | null = null;
      if (spendPercent >= CRITICAL_THRESHOLD) {
        severity = 'critical';
      } else if (spendPercent >= WARN_THRESHOLD || projectedPercent >= CRITICAL_THRESHOLD) {
        severity = 'high';
      }

      if (!severity) continue;

      const throttleKey = `cost_overrun_alert:${row.mission_id}`;
      if (await isAlertThrottled(throttleKey)) {
        throttled += 1;
        continue;
      }

      const alertId = await triggerAgentCostOverrunAlert({
        missionId: row.mission_id,
        workspaceId: row.workspace_id,
        ownerUserId: row.owner_user_id,
        budgetCents: row.budget_cents,
        spentCents: row.spent_cents,
        spendPercent: Math.round(spendPercent * 10000) / 100,
        projectedPercent: Math.round(projectedPercent * 10000) / 100,
        hourlyBurnRateCents,
        timeframeEnd: row.timeframe_end,
        severity,
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