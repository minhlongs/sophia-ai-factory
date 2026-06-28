/**
 * Status store — D1 read/write helpers for status_check, rollup, incident tables.
 * @module lib/status/status-store
 */

export type CheckStatus = 'ok' | 'degraded' | 'down';

export interface StatusCheckInput {
  ts: number;
  status: CheckStatus;
  latencyMs: number | null;
  error?: string | null;
}

export interface DayRollup {
  date: string;
  totalChecks: number;
  okChecks: number;
  uptimePct: number;
  p99Ms: number | null;
}

export interface StatusIncident {
  id: string;
  startedAt: number;
  endedAt: number | null;
  severity: string;
  title: string;
  description: string | null;
  postmortemUrl: string | null;
}

interface CheckRow {
  id: number;
  ts: number;
  status: string;
  latency_ms: number | null;
  error: string | null;
}

interface RollupRow {
  date: string;
  total_checks: number;
  ok_checks: number;
  p99_ms: number | null;
}

interface IncidentRow {
  id: string;
  started_at: number;
  ended_at: number | null;
  severity: string;
  title: string;
  description: string | null;
  postmortem_url: string | null;
}

/** Insert a 5-minute check result. Sanitize error strings to avoid leaking secrets. */
export async function recordCheck(db: D1Database, input: StatusCheckInput): Promise<void> {
  const safeError = input.error
    ? input.error.slice(0, 200).replace(/[a-z]{2,}_[A-Za-z0-9]{20,}/g, '[REDACTED]')
    : null;
  await db
    .prepare(`INSERT INTO status_check (ts, status, latency_ms, error) VALUES (?1,?2,?3,?4)`)
    .bind(input.ts, input.status, input.latencyMs, safeError)
    .run();
}

/** Return last N checks for incident state machine. */
export async function getRecentChecks(db: D1Database, limit = 6): Promise<CheckRow[]> {
  const result = await db
    .prepare(`SELECT id, ts, status, latency_ms, error FROM status_check ORDER BY ts DESC LIMIT ?1`)
    .bind(limit)
    .all<CheckRow>();
  return result.results ?? [];
}

/** Return last `daysBack` daily rollups in ascending date order. */
export async function getRollup(db: D1Database, daysBack: number): Promise<DayRollup[]> {
  const result = await db
    .prepare(`SELECT date, total_checks, ok_checks, p99_ms FROM status_day_rollup ORDER BY date DESC LIMIT ?1`)
    .bind(daysBack)
    .all<RollupRow>();
  return (result.results ?? []).reverse().map(r => ({
    date: r.date,
    totalChecks: r.total_checks,
    okChecks: r.ok_checks,
    uptimePct: r.total_checks > 0 ? (r.ok_checks / r.total_checks) * 100 : 100,
    p99Ms: r.p99_ms,
  }));
}

/** Return the single open incident (ended_at IS NULL) or null. */
export async function getActiveIncident(db: D1Database): Promise<StatusIncident | null> {
  const row = await db
    .prepare(`SELECT * FROM status_incident WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`)
    .first<IncidentRow>();
  return row ? mapIncident(row) : null;
}

/** Return the last N resolved incidents. */
export async function listResolvedIncidents(db: D1Database, limit = 5): Promise<StatusIncident[]> {
  const result = await db
    .prepare(`SELECT * FROM status_incident WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?1`)
    .bind(limit)
    .all<IncidentRow>();
  return (result.results ?? []).map(mapIncident);
}

/** Open a new incident. */
export async function openIncident(db: D1Database, title: string, severity = 'minor'): Promise<string> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(`INSERT INTO status_incident (id, started_at, severity, title) VALUES (?1,?2,?3,?4)`)
    .bind(id, now, severity, title)
    .run();
  return id;
}

/** Close the active incident. */
export async function closeIncident(db: D1Database, id: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(`UPDATE status_incident SET ended_at = ?1 WHERE id = ?2 AND ended_at IS NULL`)
    .bind(now, id)
    .run();
}

function mapIncident(r: IncidentRow): StatusIncident {
  return {
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    severity: r.severity,
    title: r.title,
    description: r.description,
    postmortemUrl: r.postmortem_url,
  };
}
