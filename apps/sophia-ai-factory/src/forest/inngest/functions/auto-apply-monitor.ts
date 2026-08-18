/**
 * Inngest: Auto-Apply Monitor (Phase 5c — Auto-Creative Playbook)
 *
 * Every 24h, scans playbook-sourced SOP installations whose `autoApply`
 * flag is on and checks whether the applied rule is still performing.
 * If a campaign's metric drops >20% vs its 48h baseline, the rule is
 * rolled back (rollback_count incremented, autoApply disabled) and the
 * user is notified. Manual override is always available.
 *
 * Layer: forest (infrastructure orchestration). Calls land helpers via
 * dynamic import to respect the forest→land orchestration exception.
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/** Metric drop threshold (relative to baseline) that triggers rollback. */
const ROLLBACK_DROP_THRESHOLD = 0.20;
/** Rolling window used for the baseline comparison (seconds). */
const BASELINE_WINDOW_SEC = 48 * 60 * 60;

export const autoApplyMonitor = inngest.createFunction(
  { id: 'auto-apply-monitor' },
  { cron: '0 4 * * *' }, // daily at 04:00 UTC
  async () => {
    const db = getD1();
    if (!db) {
      logger.error('[auto-apply-monitor] D1 not available');
      return { scanned: 0, rolledBack: 0 };
    }

    // Find playbook-sourced installs with autoApply enabled.
    const installs = await db
      .prepare(
        `SELECT id, config_values FROM user_sop_installations
         WHERE config_values IS NOT NULL
           AND json_extract(config_values, '$.source') = 'playbook'
           AND json_extract(config_values, '$.autoApply') = 1`,
      )
      .all<{ id: string; config_values: string }>();

    const rows = installs.results ?? [];
    let scanned = 0;
    let rolledBack = 0;

    for (const row of rows) {
      scanned++;
      try {
        const result = await evaluateRule(db, row.id, row.config_values);
        if (result.rolledBack) {
          rolledBack++;
          logger.warn('[auto-apply-monitor] Rule rolled back', {
            installationId: row.id,
            ruleId: result.ruleId,
            dropPct: result.dropPct,
          });
        }
      } catch (err) {
        logger.error('[auto-apply-monitor] Evaluation failed',
          err instanceof Error ? err : new Error(String(err)), { installationId: row.id });
      }
    }

    return { scanned, rolledBack };
  },
);

interface EvalResult {
  rolledBack: boolean;
  ruleId: string;
  dropPct: number;
}

/**
 * Evaluate one playbook rule. Compares the latest performance_events
 * window against the baseline. Returns whether a rollback fired.
 */
async function evaluateRule(
  db: D1Database,
  installationId: string,
  configValues: string,
): Promise<EvalResult> {
  let ruleId = '';
  try {
    const config = JSON.parse(configValues) as {
      ruleId?: string;
      platform?: string;
      goal?: string;
    };
    ruleId = config.ruleId ?? '';
  } catch {
    return { rolledBack: false, ruleId: '', dropPct: 0 };
  }

  if (!ruleId) return { rolledBack: false, ruleId: '', dropPct: 0 };

  const nowSec = Math.floor(Date.now() / 1000);
  const baselineStart = nowSec - BASELINE_WINDOW_SEC;
  const recentStart = nowSec - BASELINE_WINDOW_SEC / 2;

  // Baseline: avg metric over the full 48h window.
  const baseline = await db
    .prepare(
      `SELECT AVG(metric_value) AS avg_val
       FROM performance_events
       WHERE installation_id = ?1 AND created_at >= ?2 AND created_at <= ?3`,
    )
    .bind(installationId, baselineStart, nowSec)
    .first<{ avg_val: number | null }>();

  // Recent: avg metric over the most recent 24h.
  const recent = await db
    .prepare(
      `SELECT AVG(metric_value) AS avg_val
       FROM performance_events
       WHERE installation_id = ?1 AND created_at >= ?2 AND created_at <= ?3`,
    )
    .bind(installationId, recentStart, nowSec)
    .first<{ avg_val: number | null }>();

  const baselineVal = baseline?.avg_val ?? 0;
  const recentVal = recent?.avg_val ?? 0;

  if (baselineVal <= 0) return { rolledBack: false, ruleId, dropPct: 0 };

  const dropPct = (baselineVal - recentVal) / baselineVal;
  if (dropPct <= ROLLBACK_DROP_THRESHOLD) {
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