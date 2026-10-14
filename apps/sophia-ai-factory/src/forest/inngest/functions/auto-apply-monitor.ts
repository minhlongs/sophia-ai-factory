/**
 * Inngest: Auto-Apply Monitor (Phase 5c — Auto-Creative Playbook)
 *
 * Every 24h, scans playbook-sourced SOP installations whose autoApply
 * is on and evaluates execution health via sop_executions (the canonical
 * SOP runs table with installation_id and status).
 *
 * Health check: compares recent 7-day failure rate against a 30-day
 * baseline (days 8-30). Triggers rollback if:
 *   - recent failure rate > baseline failure rate * 2, OR
 *   - recent failure rate > 50% (absolute threshold)
 *
 * Rollback: disables autoApply on the installation config and increments
 * playbook_rules.rollback_count. Manual override is always available.
 *
 * Layer: forest (infrastructure orchestration).
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  evaluateRule,
  RECENT_WINDOW_SEC,
  BASELINE_WINDOW_SEC,
  BASELINE_MIN_AGE_SEC,
  ROLLBACK_FAILURE_MULTIPLIER,
  ABSOLUTE_FAILURE_THRESHOLD,
  type EvalResult,
  type FailureCounts,
} from './auto-apply-monitor-helpers';

export {
  evaluateRule,
  RECENT_WINDOW_SEC,
  BASELINE_WINDOW_SEC,
  BASELINE_MIN_AGE_SEC,
  ROLLBACK_FAILURE_MULTIPLIER,
  ABSOLUTE_FAILURE_THRESHOLD,
  type EvalResult,
  type FailureCounts,
};

export const autoApplyMonitor = inngest.createFunction(
  { id: 'auto-apply-monitor' },
  { cron: '0 4 * * *' }, // daily at 04:00 UTC
  async () => {
    const db = await getD1();
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
