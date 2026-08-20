/**
 * Agent Health Resolver — Computes agent health metrics
 * Layer: forest
 * Purpose: Aggregates agent task outcomes to produce health summaries for dashboard
 */

import { getD1 } from '@/seed/db/client';
import type { AgentRoleHealth, AgentHealthSummary } from './types';

// Re-export types for consumers
export type { AgentHealthSummary, AgentRoleHealth };

/**
 * Default time window for health metrics (24 hours)
 */
const HEALTH_WINDOW_HOURS = 24;

/**
 * Build the date range for the health query
 */
function getTimeWindow() {
  const now = new Date();
  const start = new Date(now.getTime() - HEALTH_WINDOW_HOURS * 60 * 60 * 1000);
  return { start, end: now };
}

/**
 * Fetch agent health summary from database
 * Aggregates task statistics by agent role over the last 24 hours
 */
export async function getAgentHealthSummary(): Promise<AgentHealthSummary> {
  const db = await getD1();
  if (!db) throw new Error('Database not available');

  const { start, end } = getTimeWindow();

  // Query agent_tasks joined with agents to get roles using raw SQL
  const sql = `
    SELECT
      a.role,
      COUNT(t.id) as total_count,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0) as completed_count,
      MAX(CASE WHEN t.status = 'failed' THEN t.completed_at ELSE NULL) as last_failure
    FROM agent_tasks t
    JOIN agents a ON t.agent_id = a.id
    WHERE t.created_at >= ?
      AND t.created_at <= ?
    GROUP BY a.role
  `;

  const stmt = db.prepare(sql).bind(start.toISOString(), end.toISOString());
  const result = await stmt.all();

  const rows = result.results || [];

  const roles: AgentRoleHealth[] = rows.map((row: Record<string, unknown>) => {
    const totalCount = Number(row.total_count) || 0;
    const completedCount = Number(row.completed_count) || 0;
    const successRate = totalCount > 0 ? completedCount / totalCount : 1;

    return {
      role: row.role as AgentRoleHealth['role'],
      totalCount,
      successRate,
      lastFailureAt: (row.last_failure as string | null) || null,
    };
  });

  // Calculate total errors in the window
  const errorCountResult = await db
    .prepare('SELECT COUNT(*) as cnt FROM agent_tasks WHERE status = ? AND created_at >= ? AND created_at <= ?')
    .bind('failed', start.toISOString(), end.toISOString())
    .first<{ cnt: number }>();

  const totalErrors24h = errorCountResult?.cnt || 0;

  return {
    roles,
    totalErrors24h,
    resolvedAt: new Date().toISOString(),
  };
}

/**
 * Health data type returned by the /api/health/agents endpoint
 */
export type AgentHealthResponse = AgentHealthSummary;
