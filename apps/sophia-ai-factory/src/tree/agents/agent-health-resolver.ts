/**
 * Agent Health Resolver — aggregates agent metrics from D1.
 * Sources: signals_events (success/fail counts) + error_log (error class breakdown).
 * 24-hour rolling window. Tolerates zero rows (Phase 03 may not be populated).
 */

/**
 * Raw D1Database access — agent-health-resolver uses native .prepare() API,
 * not the Supabase-style D1Client wrapper from createServerClient().
 */
function getD1(): D1Database {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;

  const ctxSymbol = Symbol.for('__cloudflare-context__');
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol];
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;

  throw new Error('[agent-health-resolver] D1 binding not available');
}

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

interface SignalsEventRow {
  role: string;
  success_count: number;
  fail_count: number;
}

interface LastFailRow {
  role: string;
  last_failure_at: string;
}

interface ErrorCountRow {
  agent_role: string;
  error_count: number;
}

/** In-memory cache to avoid hammering D1 on every 30s poll */
let cache: { summary: AgentHealthSummary; expires: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function resolveAgentHealth(): Promise<AgentHealthSummary> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.summary;

  const db = await getD1();
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  // Success/fail counts per role from signals_events
  let signalRows: SignalsEventRow[] = [];
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
    signalRows = (result.results ?? []) as unknown as SignalsEventRow[];
  } catch {
    // signals_events may not exist yet — return zeroed metrics
  }

  // Last failure timestamp per role from signals_events
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
  } catch { /* tolerate */ }

  // Error count per agent_role from error_log (ctx_json field)
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
  } catch { /* tolerate */ }

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
