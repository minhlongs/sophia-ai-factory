/**
 * Agent Health Resolver — aggregates agent metrics from D1.
 * Sources: signals_events (success/fail counts) + error_log (error class breakdown).
 * 24-hour rolling window. Tolerates zero rows (Phase 03 may not be populated).
 */

import {
  getAgentHealthD1,
  querySignalRoleCounts,
  queryLastFailureMap,
  queryTotalErrors24h,
} from './agent-health-queries';

export interface AgentRoleHealth {
  role: string;
  successCount: number;
  failCount: number;
  totalCount: number;
  successRate: number; // 0–1
  lastFailureAt: string | null;
}

export interface AgentHealthSummary {
  roles: AgentRoleHealth[];
  totalErrors24h: number;
  resolvedAt: string;
}

/** In-memory cache to avoid hammering D1 on every 30s poll */
let cache: { summary: AgentHealthSummary; expires: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function resolveAgentHealth(): Promise<AgentHealthSummary> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.summary;

  const db = await getAgentHealthD1();
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const signalRows = await querySignalRoleCounts(db, since);
  const lastFailMap = await queryLastFailureMap(db, since);
  const totalErrors24h = await queryTotalErrors24h(db, since);

  const roles: AgentRoleHealth[] = signalRows.map((row) => {
    const success = Number(row.success_count ?? 0);
    const fail = Number(row.fail_count ?? 0);
    const total = success + fail;
    return {
      role: row.role,
      successCount: success,
      failCount: fail,
      totalCount: total,
      successRate: total > 0 ? success / total : 0,
      lastFailureAt: lastFailMap.get(row.role) ?? null,
    };
  });

  const summary: AgentHealthSummary = {
    roles,
    totalErrors24h,
    resolvedAt: new Date().toISOString(),
  };

  cache = { summary, expires: now + CACHE_TTL_MS };
  return summary;
}
