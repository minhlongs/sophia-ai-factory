/**
 * Edge Healing Incident Audit Logger and Persistence
 *
 * @module tree/swarm/self-healing/incident-logger
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EdgeHealingIncident,
  EdgeHealingIncidentRow,
  EdgeHealingAction,
  HealingIncidentSeverity,
  HealingIncidentStatus,
  SwarmRegion,
} from '@/seed/types/autonomous-swarm';
import { mapRowToHealingIncident } from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Logs a self-healing incident into the D1 audit table.
 */
export async function logHealingIncident(
  db: D1Database,
  input: {
    nodeId: string;
    targetRegion: SwarmRegion;
    healingAction: EdgeHealingAction;
    triggerReason: string;
    severity?: HealingIncidentSeverity;
    previousState: string;
    remediatedState: string;
    failoverTargetNodeId?: string | null;
    executionDurationMs?: number;
    automatedRecovery?: boolean;
    status?: HealingIncidentStatus;
    metadata?: Record<string, unknown>;
  }
): Promise<EdgeHealingIncident> {
  const now = Date.now();
  const id = `ehi_${Math.random().toString(16).slice(2, 10)}`;
  const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  const incidentCode = `INC-HEAL-${dateStr}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;

  const severity = input.severity ?? 'medium';
  const status = input.status ?? 'executed';
  const automatedRecoveryNum = input.automatedRecovery === false ? 0 : 1;
  const metadataJson = JSON.stringify(input.metadata ?? {});

  await db
    .prepare(`
      INSERT INTO edge_healing_incidents (
        id, incident_code, node_id, target_region, healing_action,
        trigger_reason, severity, previous_state, remediated_state,
        failover_target_node_id, execution_duration_ms, automated_recovery,
        status, metadata_json, detected_at, recovered_at, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, NULL, ?16)
    `)
    .bind(
      id,
      incidentCode,
      input.nodeId,
      input.targetRegion,
      input.healingAction,
      input.triggerReason,
      severity,
      input.previousState,
      input.remediatedState,
      input.failoverTargetNodeId ?? null,
      input.executionDurationMs ?? 0,
      automatedRecoveryNum,
      status,
      metadataJson,
      now,
      now
    )
    .run();

  const incident: EdgeHealingIncident = {
    id,
    incidentCode,
    nodeId: input.nodeId,
    targetRegion: input.targetRegion,
    healingAction: input.healingAction,
    triggerReason: input.triggerReason,
    severity,
    previousState: input.previousState,
    remediatedState: input.remediatedState,
    failoverTargetNodeId: input.failoverTargetNodeId ?? null,
    executionDurationMs: input.executionDurationMs ?? 0,
    automatedRecovery: input.automatedRecovery !== false,
    status,
    metadata: input.metadata ?? {},
    detectedAt: now,
    recoveredAt: null,
    createdAt: now,
  };

  logger.info('[self-healing-arbiter] Incident logged', {
    incidentCode,
    nodeId: input.nodeId,
    action: input.healingAction,
  });

  return incident;
}

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
