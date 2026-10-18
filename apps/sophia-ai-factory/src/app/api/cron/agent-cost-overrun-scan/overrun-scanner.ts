/**
 * Mission scanning and alert dispatch logic for agent-cost-overrun-scan cron.
 */

import type { getD1Safe } from '@/seed/db/client';
import { isAlertThrottled, markAlertThrottled } from '@/forest/alerts/alert-throttle';
import { triggerAgentCostOverrunAlert } from '@/forest/alerts/agent-cost-overrun-alert';

const ALERT_THROTTLE_TTL = 2 * 60 * 60; // 2 hours in KV seconds
const WARN_THRESHOLD = 0.85; // 85% of budget
const CRITICAL_THRESHOLD = 1.0; // 100% of budget

export interface MissionRow {
  mission_id: string;
  workspace_id: string;
  budget_cents: number;
  spent_cents: number;
  status: string;
  timeframe_end: number;
  owner_user_id: string;
}

export interface OverrunScanCounts {
  scanned: number;
  alerted: number;
  throttled: number;
}

type D1Binding = NonNullable<Awaited<ReturnType<typeof getD1Safe>>>;

export async function runMissionCostOverrunScan(
  db: D1Binding,
  counts: OverrunScanCounts,
): Promise<void> {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;

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

  counts.scanned = rows.length;

  for (const row of rows) {
    const spendPercent = row.spent_cents / row.budget_cents;
    const remainingMs = row.timeframe_end - now;
    const remainingHours = Math.max(1, remainingMs / 3600000);

    const burnStmt = db.prepare(
      `SELECT COALESCE(SUM(CAST(json_extract(payload, '$.costCents') AS INTEGER)), 0) AS hourly_burn
       FROM performance_events
       WHERE event_type = 'mission.cost_recorded'
         AND json_extract(payload, '$.missionId') = ?
         AND recorded_at >= ?`
    );
    const { results: burnResults } = await burnStmt
      .bind(row.mission_id, hourAgo)
      .all<{ hourly_burn: number }>();
    const hourlyBurnRateCents = burnResults?.[0]?.hourly_burn ?? 0;

    const projectedTotalCents = row.spent_cents + hourlyBurnRateCents * remainingHours;
    const projectedPercent = projectedTotalCents / row.budget_cents;

    let severity: 'high' | 'critical' | null = null;
    if (spendPercent >= CRITICAL_THRESHOLD) {
      severity = 'critical';
    } else if (spendPercent >= WARN_THRESHOLD || projectedPercent >= CRITICAL_THRESHOLD) {
      severity = 'high';
    }

    if (!severity) continue;

    const throttleKey = `cost_overrun_alert:${row.mission_id}`;
    if (await isAlertThrottled(throttleKey)) {
      counts.throttled += 1;
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
      counts.alerted += 1;
    }
  }
}
