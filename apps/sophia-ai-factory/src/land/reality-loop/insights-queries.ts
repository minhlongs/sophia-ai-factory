/**
 * Reality Loop v1 — D1 query helpers for workspace insights.
 *
 * Layer: land (business domain workflow).
 *
 * @module land/reality-loop/insights-queries
 */

import { createServerClient } from '@/seed/db/client';
import type { RealityLoopInsights } from './insights-types';

export function createEmptyRealityLoopInsights(workspaceId: string): RealityLoopInsights {
  return {
    workspaceId,
    missionsCreated: 0,
    missionsCompleted: 0,
    completionRate: null,
    creativeAccepted: 0,
    creativeRejected: 0,
    acceptanceRate: null,
    humanCorrections: 0,
    correctionRate: null,
    agentFailures: [],
    agentFailureTotal: 0,
    missionCostCents: 0,
    memory: { used: 0, corrected: 0, correctionRate: null },
    economic: { revenueCents: null, costCents: null, netCents: null, roiPct: null },
    feedback: null,
  };
}

export interface WorkspaceEventRollup {
  missionsCreated: number;
  missionsCompleted: number;
  creativeAccepted: number;
  creativeRejected: number;
  humanCorrections: number;
  missionCostCents: number;
  memoryUsed: number;
  memoryCorrected: number;
}

export async function queryWorkspaceEventRollup(
  db: ReturnType<typeof createServerClient>,
  workspaceId: string,
): Promise<WorkspaceEventRollup> {
  const funnel = await db
    .prepare(
      `SELECT
         COUNT(*) AS created,
         SUM(CASE WHEN status IN ('completed', 'review') THEN 1 ELSE 0 END) AS completed
       FROM creative_missions
       WHERE workspace_id = ?1`,
    )
    .bind(workspaceId)
    .first<{ created: number | null; completed: number | null }>();

  const creative = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN event_type = 'creative.accepted' THEN count ELSE 0 END) AS accepted,
         SUM(CASE WHEN event_type = 'creative.rejected' THEN count ELSE 0 END) AS rejected
       FROM performance_events
       WHERE workspace_id = ?1
         AND event_type IN ('creative.accepted', 'creative.rejected')`,
    )
    .bind(workspaceId)
    .first<{ accepted: number | null; rejected: number | null }>();

  const corrections = await db
    .prepare(
      `SELECT SUM(count) AS cnt
       FROM performance_events
       WHERE workspace_id = ?1
         AND event_type = 'creative.edited'`,
    )
    .bind(workspaceId)
    .first<{ cnt: number | null }>();

  const cost = await db
    .prepare(
      `SELECT SUM(value_cents) AS cost_cents
       FROM performance_events
       WHERE workspace_id = ?1
         AND event_type = 'mission.cost_recorded'`,
    )
    .bind(workspaceId)
    .first<{ cost_cents: number | null }>();

  const memory = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN event_type = 'memory.used' THEN count ELSE 0 END) AS used,
         SUM(CASE WHEN event_type = 'memory.corrected' THEN count ELSE 0 END) AS corrected
       FROM performance_events
       WHERE workspace_id = ?1
         AND event_type IN ('memory.used', 'memory.corrected')`,
    )
    .bind(workspaceId)
    .first<{ used: number | null; corrected: number | null }>();

  return {
    missionsCreated: funnel?.created ?? 0,
    missionsCompleted: funnel?.completed ?? 0,
    creativeAccepted: creative?.accepted ?? 0,
    creativeRejected: creative?.rejected ?? 0,
    humanCorrections: corrections?.cnt ?? 0,
    missionCostCents: cost?.cost_cents ?? 0,
    memoryUsed: memory?.used ?? 0,
    memoryCorrected: memory?.corrected ?? 0,
  };
}
