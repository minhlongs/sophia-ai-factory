/**
 * Status store — D1 read/write helpers for status_check, rollup, incident tables.
 * @module lib/status/status-store
 */

export {
  getActiveIncident,
  listResolvedIncidents,
  openIncident,
  closeIncident,
  type StatusIncident,
} from './status-incident-store';

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
