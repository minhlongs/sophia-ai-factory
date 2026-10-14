/**
 * Auto-Apply Monitor Evaluation Helpers (Phase 5c — Auto-Creative Playbook)
 *
 * Evaluates execution health for playbook-sourced SOP installations and
 * performs rollback when recent failure rate spikes above baseline or threshold.
 *
 * Layer: forest (infrastructure orchestration).
 */

/** Recent evaluation window: last 7 days (seconds). */
export const RECENT_WINDOW_SEC = 7 * 24 * 60 * 60;
/** Baseline lookback start: 30 days before now (seconds). */
export const BASELINE_WINDOW_SEC = 30 * 24 * 60 * 60;
/** Baseline upper bound: must be older than the recent window (seconds). */
export const BASELINE_MIN_AGE_SEC = 7 * 24 * 60 * 60;
/** Rollback fires when recent failure rate exceeds baseline by this factor. */
export const ROLLBACK_FAILURE_MULTIPLIER = 2;
/** Rollback fires when recent failure rate exceeds this absolute rate. */
export const ABSOLUTE_FAILURE_THRESHOLD = 0.5;

export interface EvalResult {
  rolledBack: boolean;
  ruleId: string;
  dropPct: number;
}

export interface FailureCounts {
  total: number;
  failed: number | null;
}

/**
 * Evaluate one playbook rule by comparing recent sop_executions failure
 * rate against the baseline window. Returns whether a rollback fired.
 */
export async function evaluateRule(
  db: D1Database,
  installationId: string,
  configValues: string,
): Promise<EvalResult> {
  let ruleId = '';
  try {
    const config = JSON.parse(configValues) as { ruleId?: string };
    ruleId = config.ruleId ?? '';
  } catch {
    return { rolledBack: false, ruleId: '', dropPct: 0 };
  }

  if (!ruleId) return { rolledBack: false, ruleId: '', dropPct: 0 };

  const nowSec = Math.floor(Date.now() / 1000);
  const recentStart = nowSec - RECENT_WINDOW_SEC;
  const baselineStart = nowSec - BASELINE_WINDOW_SEC;
  const baselineEnd = nowSec - BASELINE_MIN_AGE_SEC;

  // Recent window: terminal executions in the last 7 days.
  const recent = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM sop_executions
       WHERE installation_id = ?1
         AND created_at >= ?2
         AND status IN ('failed', 'completed')`,
    )
    .bind(installationId, recentStart)
    .first<FailureCounts>();

  // Baseline window: terminal executions from days 8-30 before now.
  const baseline = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM sop_executions
       WHERE installation_id = ?1
         AND created_at >= ?2
         AND created_at < ?3
         AND status IN ('failed', 'completed')`,
    )
    .bind(installationId, baselineStart, baselineEnd)
    .first<FailureCounts>();

  const recentTotal = recent?.total ?? 0;
  if (recentTotal === 0) return { rolledBack: false, ruleId, dropPct: 0 };

  const recentFailureRate = (recent?.failed ?? 0) / recentTotal;
  const baselineTotal = baseline?.total ?? 0;
  const baselineFailureRate = baselineTotal > 0
    ? (baseline?.failed ?? 0) / baselineTotal
    : 0;

  // dropPct keeps the caller-facing field name; semantically it is now
  // the failure-rate delta (recent minus baseline).
  const dropPct = recentFailureRate - baselineFailureRate;
  const spike = recentFailureRate > baselineFailureRate * ROLLBACK_FAILURE_MULTIPLIER;
  const absolute = recentFailureRate > ABSOLUTE_FAILURE_THRESHOLD;
  if (!spike && !absolute) {
    return { rolledBack: false, ruleId, dropPct };
  }

  // Threshold exceeded — roll back: disable autoApply, increment rollback_count.
  await db
    .prepare(
      `UPDATE user_sop_installations
          SET config_values = json_set(config_values, '$.autoApply', 0)
        WHERE id = ?1`,
    )
    .bind(installationId)
    .run();

  // Increment rollback counter on the rule row if it exists.
  try {
    await db
      .prepare(`UPDATE playbook_rules SET rollback_count = rollback_count + 1 WHERE id = ?1`)
      .bind(ruleId)
      .run();
  } catch {
    // playbook_rules may not exist yet — non-fatal.
  }

  return { rolledBack: true, ruleId, dropPct };
}
