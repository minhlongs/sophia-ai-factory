/**
 * Analytics — Agent Performance Resolver
 *
 * D1 SQL aggregates for agent task lifecycle events.
 * Reads from signals_events (exists, maintained by track()).
 *
 * Returns per-role: start count, complete count, fail count,
 * completion rate, average duration. Windowed to 24h or 7d.
 *
 * Uses raw D1Database (same pattern as d1-aggregates.ts).
 * SECURITY: aggregate counts only — no PII, no raw prompts.
 */

import { getD1 } from '@/seed/db/client';
import {
  windowStart,
  pivotRowsToRoleMetrics,
  type WindowOption,
  type AgentRoleMetrics,
  type AgentPerformanceReport,
  type AggRow,
} from './agent-performance-helpers';

export type { WindowOption, AgentRoleMetrics, AgentPerformanceReport };

/**
 * Query agent performance aggregates from signals_events.
 *
 * @param db      Raw D1Database (from globalThis.__env.DB)
 * @param orgId   Organization ID to scope results
 * @param window  Time window: '24h' or '7d'
 * @param role    Optional: filter to a specific agent role
 */
export async function resolveAgentPerformance(
  db: D1Database,
  orgId: string,
  window: WindowOption,
  role?: string,
): Promise<AgentPerformanceReport> {
  const ts = windowStart(window);

  const eventTypes = [
    'agent_task_start',
    'agent_task_complete',
    'agent_task_fail',
  ];

  const placeholders = eventTypes.map(() => '?').join(', ');

  let sql = `
    SELECT
      json_extract(props_json, '$.agent_role') AS role,
      event_type,
      COUNT(*) AS count,
      AVG(CAST(json_extract(props_json, '$.duration_ms') AS REAL)) AS avg_duration_ms
    FROM signals_events
    WHERE event_type IN (${placeholders})
      AND org_id = ?
      AND ts >= ?
  `;

  const bindings: (string | number)[] = [...eventTypes, orgId, ts];

  if (role) {
    sql += `  AND json_extract(props_json, '$.agent_role') = ?\n`;
    bindings.push(role);
  }

  sql += `GROUP BY role, event_type`;

  const result = await db
    .prepare(sql)
    .bind(...bindings)
    .all<AggRow>();

  const rows = result.results ?? [];

  return {
    window,
    generated_at: new Date().toISOString(),
    roles: pivotRowsToRoleMetrics(rows),
  };
}

/** Get D1 database — canonical pattern */
export async function getD1ForAnalytics(): Promise<D1Database> {
  const _db = await getD1();
  if (!_db) throw new Error('[analytics/agent-performance] D1 binding not available');
  return _db;
}
