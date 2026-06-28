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

// ── Types ─────────────────────────────────────────────────────────────────────

export type WindowOption = '24h' | '7d'

export interface AgentRoleMetrics {
  role: string
  variant: string
  start_count: number
  complete_count: number
  fail_count: number
  /** Completion rate 0–1 (complete / start), null if no starts */
  completion_rate: number | null
  /** Average duration in ms for completed tasks, null if none */
  avg_duration_ms: number | null
}

export interface AgentPerformanceReport {
  window: WindowOption
  generated_at: string
  roles: AgentRoleMetrics[]
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Returns unix ms timestamp for the start of the given window */
function windowStart(window: WindowOption): number {
  const hours = window === '24h' ? 24 : 7 * 24
  return Date.now() - hours * 60 * 60 * 1000
}

function toInt(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  if (typeof v === 'string') return parseInt(v, 10) || 0
  return 0
}

function toFloatOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }
  return null
}

// ── D1 row shape ─────────────────────────────────────────────────────────────

interface AggRow {
  role: string | null
  event_type: string | null
  count: number | string
  avg_duration_ms: number | string | null
}

// ── Main resolver ─────────────────────────────────────────────────────────────

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
  const ts = windowStart(window)

  const eventTypes = [
    'agent_task_start',
    'agent_task_complete',
    'agent_task_fail',
  ]

  const placeholders = eventTypes.map(() => '?').join(', ')

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
  `

  const bindings: (string | number)[] = [...eventTypes, orgId, ts]

  if (role) {
    sql += `  AND json_extract(props_json, '$.agent_role') = ?\n`
    bindings.push(role)
  }

  sql += `GROUP BY role, event_type`

  const result = await db
    .prepare(sql)
    .bind(...bindings)
    .all<AggRow>()

  const rows = result.results ?? []

  // ── Pivot rows into per-role metrics ───────────────────────────────────────
  const roleMap = new Map<string, AgentRoleMetrics>()

  for (const row of rows) {
    const roleName = row.role ?? 'unknown'
    if (!roleMap.has(roleName)) {
      roleMap.set(roleName, {
        role: roleName,
        variant: 'control', // variant not aggregated here — kept simple per YAGNI
        start_count: 0,
        complete_count: 0,
        fail_count: 0,
        completion_rate: null,
        avg_duration_ms: null,
      })
    }

    const entry = roleMap.get(roleName)!
    const count = toInt(row.count)

    switch (row.event_type) {
      case 'agent_task_start':
        entry.start_count = count
        break
      case 'agent_task_complete':
        entry.complete_count = count
        entry.avg_duration_ms = toFloatOrNull(row.avg_duration_ms)
        break
      case 'agent_task_fail':
        entry.fail_count = count
        break
    }
  }

  // Compute derived completion_rate
  for (const entry of roleMap.values()) {
    entry.completion_rate =
      entry.start_count > 0
        ? entry.complete_count / entry.start_count
        : null
  }

  return {
    window,
    generated_at: new Date().toISOString(),
    roles: Array.from(roleMap.values()),
  }
}

/** Raw D1 accessor — mirrors track.ts pattern for test mocking compatibility */
export function getD1RawForAnalytics(): D1Database {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
  if (env?.DB) return env.DB as D1Database

  const ctxSymbol = Symbol.for('__cloudflare-context__')
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol]
  if (ctx?.env?.DB) return ctx.env.DB as D1Database

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
  if (globalDb) return globalDb

  throw new Error('[analytics/agent-performance] D1 binding not available')
}
