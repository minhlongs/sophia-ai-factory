/**
 * Edge Healing Incident Resolution and Query Helpers
 *
 * @module tree/swarm/self-healing/incident-queries
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EdgeHealingIncident,
  EdgeHealingIncidentRow,
  HealingIncidentStatus,
} from '@/seed/types/autonomous-swarm';
import { mapRowToHealingIncident } from '@/seed/types/autonomous-swarm';

/**
 * Resolves an existing edge healing incident.
 */
export async function resolveHealingIncident(
  db: D1Database,
  incidentId: string,
  resolutionNotes?: string
): Promise<{ success: boolean }> {
  const now = Date.now();
  const row = await db
    .prepare('SELECT metadata_json FROM edge_healing_incidents WHERE id = ?1 LIMIT 1')
    .bind(incidentId)
    .first<{ metadata_json: string }>();

  if (!row) {
    return { success: false };
  }

  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata_json);
  } catch {
    metadata = {};
  }

  if (resolutionNotes) {
    metadata.resolutionNotes = resolutionNotes;
  }

  const result = await db
    .prepare(`
      UPDATE edge_healing_incidents
      SET
        status = 'recovered',
        recovered_at = ?1,
        metadata_json = ?2
      WHERE id = ?3
    `)
    .bind(now, JSON.stringify(metadata), incidentId)
    .run();

  const success = Boolean(result.meta.changes && result.meta.changes > 0);
  return { success };
}

/**
 * Queries edge healing incidents audit history.
 */
export async function queryHealingIncidents(
  db: D1Database,
  options?: { nodeId?: string; limit?: number; status?: HealingIncidentStatus }
): Promise<EdgeHealingIncident[]> {
  let query = 'SELECT * FROM edge_healing_incidents WHERE 1=1';
  const params: unknown[] = [];

  if (options?.nodeId) {
    params.push(options.nodeId);
    query += ` AND node_id = ?${params.length}`;
  }
  if (options?.status) {
    params.push(options.status);
    query += ` AND status = ?${params.length}`;
  }

  const limit = options?.limit ?? 50;
  params.push(limit);
  query += ` ORDER BY detected_at DESC LIMIT ?${params.length}`;

  const { results } = await db.prepare(query).bind(...params).all<EdgeHealingIncidentRow>();
  return (results ?? []).map(mapRowToHealingIncident);
}
