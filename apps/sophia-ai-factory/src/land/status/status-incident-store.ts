/**
 * D1 read/write helpers for the `status_incident` table.
 * @module land/status/status-incident-store
 */

export interface StatusIncident {
  id: string;
  startedAt: number;
  endedAt: number | null;
  severity: string;
  title: string;
  description: string | null;
  postmortemUrl: string | null;
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
