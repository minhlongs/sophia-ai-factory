/**
 * Agent failure taxonomy query — Q7, Phase G taxonomy.
 *
 * Split from insights.ts to keep each module ≤200 LOC. Aggregates
 * agent.failed events by failure_class (stored in metrics_json) for one
 * workspace. Unknown classes (or a missing failure_class) bucket to UNKNOWN.
 *
 * @module land/reality-loop/insights-failures
 */

import { createServerClient } from '@/seed/db/client';
import { type FailureClassCount } from './insights';

/**
 * Aggregate agent.failed events by failure_class for one workspace.
 * Returns the bucket list (DESC by count) plus the total.
 */
export async function getAgentFailures(
  db: ReturnType<typeof createServerClient>,
  workspaceId: string,
): Promise<{ agentFailures: FailureClassCount[]; agentFailureTotal: number }> {
  const failures = await db
    .prepare(
      `SELECT
         COALESCE(json_extract(metrics_json, '$.failure_class'), 'UNKNOWN') AS failure_class,
         SUM(count) AS cnt
       FROM performance_events
       WHERE workspace_id = ?1
         AND event_type = 'agent.failed'
       GROUP BY failure_class
       ORDER BY cnt DESC`,
    )
    .bind(workspaceId)
    .all<{ failure_class: string; cnt: number }>();
  const agentFailures = (failures.results ?? []).map((r) => ({
    failureClass: r.failure_class,
    count: r.cnt,
  }));
  const agentFailureTotal = agentFailures.reduce((sum, f) => sum + f.count, 0);
  return { agentFailures, agentFailureTotal };
}
