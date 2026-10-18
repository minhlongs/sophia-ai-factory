/**
 * Agent Health D1 Query Helpers
 *
 * Layer: tree/agents
 */

export interface SignalsEventRow {
  role: string;
  success_count: number;
  fail_count: number;
}

export interface LastFailRow {
  role: string;
  last_failure_at: string;
}

export interface ErrorCountRow {
  agent_role: string;
  error_count: number;
}

/**
 * Raw D1Database access — agent-health-resolver uses native .prepare() API,
 * not the Supabase-style D1Client wrapper from createServerClient().
 */
export function getAgentHealthD1(): D1Database {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;

  const ctxSymbol = Symbol.for('__cloudflare-context__');
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol];
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;

  throw new Error('[agent-health-resolver] D1 binding not available');
}

export async function querySignalRoleCounts(
  db: D1Database,
  since: string,
): Promise<SignalsEventRow[]> {
  try {
    const result = await db
      .prepare(
        `SELECT
           json_extract(payload, '$.agent_role') AS role,
           SUM(CASE WHEN event_type = 'agent_task_complete' THEN 1 ELSE 0 END) AS success_count,
           SUM(CASE WHEN event_type = 'agent_task_fail' THEN 1 ELSE 0 END) AS fail_count
         FROM signals_events
         WHERE ts >= ? AND json_extract(payload, '$.agent_role') IS NOT NULL
         GROUP BY json_extract(payload, '$.agent_role')`
      )
      .bind(since)
      .all();
    return (result.results ?? []) as unknown as SignalsEventRow[];
  } catch {
    return [];
  }
}

export async function queryLastFailureMap(
  db: D1Database,
  since: string,
): Promise<Map<string, string>> {
  const lastFailMap = new Map<string, string>();
  try {
    const result = await db
      .prepare(
        `SELECT
           json_extract(payload, '$.agent_role') AS role,
           MAX(ts) AS last_failure_at
         FROM signals_events
         WHERE event_type = 'agent_task_fail'
           AND ts >= ?
           AND json_extract(payload, '$.agent_role') IS NOT NULL
         GROUP BY json_extract(payload, '$.agent_role')`
      )
      .bind(since)
      .all();
    for (const row of (result.results ?? []) as unknown as LastFailRow[]) {
      if (row.role) lastFailMap.set(row.role, row.last_failure_at);
    }
  } catch {
    // tolerate missing table
  }
  return lastFailMap;
}

export async function queryTotalErrors24h(
  db: D1Database,
  since: string,
): Promise<number> {
  let totalErrors24h = 0;
  try {
    const result = await db
      .prepare(
        `SELECT
           json_extract(ctx_json, '$.agent_role') AS agent_role,
           COUNT(*) AS error_count
         FROM error_log
         WHERE ts >= ?
           AND json_extract(ctx_json, '$.agent_role') IS NOT NULL
         GROUP BY json_extract(ctx_json, '$.agent_role')`
      )
      .bind(since)
      .all();
    for (const row of (result.results ?? []) as unknown as ErrorCountRow[]) {
      totalErrors24h += Number(row.error_count ?? 0);
    }
  } catch {
    // tolerate missing table
  }
  return totalErrors24h;
}
