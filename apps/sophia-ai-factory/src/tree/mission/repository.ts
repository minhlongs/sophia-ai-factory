/**
 * Mission repository — CRUD persistence for creative missions.
 * Layer: tree (domain-specific reusable)
 *
 * Pure data access and row mapping. Lifecycle transition rules live in
 * types.ts; metrics aggregation lives in metrics.ts.
 *
 * @module tree/mission/repository
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { Mission, CreativeMissionStatus, AutonomyLevel, CreativeGoal } from '@/seed/types/creative-economy';
import { MissionError, newMissionId, canTransition } from './types';

// ── Row mapping ──────────────────────────────────────────────────────────────

interface MissionRow {
  id: string;
  workspace_id: string;
  creator_id: string;
  brand_id: string | null;
  title: string;
  objective: string;
  audience: string;
  geography: string;
  timeframe_start: number;
  timeframe_end: number;
  budget_cents: number;
  spent_cents: number;
  autonomy_level: number;
  channels: string;
  monetization_goals: string;
  constraints: string;
  success_metrics: string;
  status: string;
  current_phase: string;
  created_at: number;
  updated_at: number;
}

function rowToDomain(row: MissionRow): Mission {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    creatorId: row.creator_id,
    brandId: row.brand_id ?? undefined,
    title: row.title,
    objective: row.objective,
    audience: row.audience,
    geography: row.geography,
    timeframeStart: row.timeframe_start,
    timeframeEnd: row.timeframe_end,
    budgetCents: row.budget_cents,
    spentCents: row.spent_cents,
    autonomyLevel: row.autonomy_level as AutonomyLevel,
    channels: JSON.parse(row.channels) as string[],
    monetizationGoals: JSON.parse(row.monetization_goals) as string[],
    constraints: JSON.parse(row.constraints) as Record<string, unknown>,
    successMetrics: JSON.parse(row.success_metrics) as Record<string, number>,
    status: row.status as CreativeMissionStatus,
    currentPhase: row.current_phase,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function domainToRow(m: Mission): Omit<MissionRow, 'created_at' | 'updated_at'> & { created_at: number; updated_at: number } {
  return {
    id: m.id,
    workspace_id: m.workspaceId,
    creator_id: m.creatorId,
    brand_id: m.brandId ?? null,
    title: m.title,
    objective: m.objective,
    audience: m.audience,
    geography: m.geography,
    timeframe_start: m.timeframeStart,
    timeframe_end: m.timeframeEnd,
    budget_cents: m.budgetCents,
    spent_cents: m.spentCents,
    autonomy_level: m.autonomyLevel,
    channels: JSON.stringify(m.channels),
    monetization_goals: JSON.stringify(m.monetizationGoals),
    constraints: JSON.stringify(m.constraints),
    success_metrics: JSON.stringify(m.successMetrics),
    status: m.status,
    current_phase: m.currentPhase,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createMission(mission: Mission): Promise<Mission> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  const now = Math.floor(Date.now() / 1000);
  mission.id = mission.id || newMissionId();
  mission.createdAt = now;
  mission.updatedAt = now;
  mission.spentCents = 0;
  if (!mission.status) mission.status = 'draft';
  if (!mission.currentPhase) mission.currentPhase = 'init';

  const r = domainToRow(mission);
  try {
    await db
      .prepare(
        `INSERT INTO creative_missions
           (id, workspace_id, creator_id, brand_id, title, objective, audience, geography,
            timeframe_start, timeframe_end, budget_cents, spent_cents, autonomy_level,
            channels, monetization_goals, constraints, success_metrics,
            status, current_phase, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        r.id, r.workspace_id, r.creator_id, r.brand_id,
        r.title, r.objective, r.audience, r.geography,
        r.timeframe_start, r.timeframe_end, r.budget_cents, r.spent_cents,
        r.autonomy_level, r.channels, r.monetization_goals, r.constraints,
        r.success_metrics, r.status, r.current_phase, r.created_at, r.updated_at,
      )
      .run();
  } catch (err) {
    throw new MissionError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }
  return mission;
}

export async function getMission(id: string): Promise<Mission | null> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  const row = await db.prepare(`SELECT * FROM creative_missions WHERE id = ?1 LIMIT 1`).bind(id).first<MissionRow>();
  if (!row) return null;
  return rowToDomain(row);
}

export async function getMissionWithGoals(id: string): Promise<(Mission & { goals: CreativeGoal[] }) | null> {
  const mission = await getMission(id);
  if (!mission) return null;
  // Import inline to avoid circular at module level
  const { getGoalsByMission } = await import('./goal');
  const goals = await getGoalsByMission(id);
  return { ...mission, goals };
}

export async function listMissions(workspaceId: string, status?: CreativeMissionStatus): Promise<Mission[]> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  let q = `SELECT * FROM creative_missions WHERE workspace_id = ?1`;
  const params: unknown[] = [workspaceId];
  if (status) {
    q += ` AND status = ?${params.length + 1}`;
    params.push(status);
  }
  q += ` ORDER BY created_at DESC`;
  const result = await db.prepare(q).bind(...params).all<MissionRow>();
  return (result.results ?? []).map(rowToDomain);
}

export async function updateMissionStatus(id: string, newStatus: CreativeMissionStatus, currentPhase: string, workspaceId?: string): Promise<Mission> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  const existing = await getMission(id);
  if (!existing) throw new MissionError('NOT_FOUND', `Mission ${id} not found`);
  if (workspaceId && existing.workspaceId !== workspaceId) {
    throw new MissionError('FORBIDDEN', `Mission ${id} does not belong to workspace ${workspaceId}`);
  }
  if (!canTransition(existing.status, newStatus)) {
    throw new MissionError('INVALID_TRANSITION', `${existing.status} → ${newStatus} not allowed`);
  }
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(`UPDATE creative_missions SET status = ?, current_phase = ?, updated_at = ? WHERE id = ? AND status = ?`)
    .bind(newStatus, currentPhase, now, id, existing.status)
    .run();
  if (result.meta.changes === 0) {
    throw new MissionError('CONCURRENT_MODIFICATION', `Mission ${id} status changed concurrently`);
  }
  const updated = await getMission(id);
  if (!updated) throw new MissionError('UPDATE_FAILED', 'Fetch after update failed');
  return updated;
}

export async function recordSpend(id: string, amountCents: number, workspaceId?: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  if (workspaceId) {
    const existing = await getMission(id);
    if (!existing) throw new MissionError('NOT_FOUND', `Mission ${id} not found`);
    if (existing.workspaceId !== workspaceId) {
      throw new MissionError('FORBIDDEN', `Mission ${id} does not belong to workspace ${workspaceId}`);
    }
  }
  await db.prepare(`UPDATE creative_missions SET spent_cents = spent_cents + ?, updated_at = ? WHERE id = ?`).bind(amountCents, Math.floor(Date.now() / 1000), id).run();

  // ── SIDE-CHANNEL: mission.cost_recorded (Q4 economics, non-fatal) ──────
  // Mirrors recordNodePerformance: never throws into the caller, never
  // enters the runner's deterministic checkpoint stream. Reads the new
  // total + workspace_id so the event carries allowlisted totals only.
  try {
    const { emitMissionCostRecorded } = await import('@/tree/performance/loop-emitters-cost');
    const row = await db.prepare(`SELECT workspace_id, budget_cents, spent_cents FROM creative_missions WHERE id = ?1 LIMIT 1`).bind(id).first<{ workspace_id: string; budget_cents: number; spent_cents: number }>();
    if (row) {
      await emitMissionCostRecorded({
        workspaceId: row.workspace_id,
        missionId: id,
        amountCents,
        totalSpentCents: row.spent_cents ?? 0,
        budgetCents: row.budget_cents ?? 0,
        recordedAt: Date.now(),
      });
    }
  } catch (err) {
    // Non-fatal: cost telemetry must never abort a spend write.
    logger.warn('[repository.recordSpend] cost event emit failed (non-fatal)', {
      missionId: id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function deleteMission(id: string, workspaceId?: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  if (workspaceId) {
    const existing = await getMission(id);
    if (!existing) throw new MissionError('NOT_FOUND', `Mission ${id} not found`);
    if (existing.workspaceId !== workspaceId) {
      throw new MissionError('FORBIDDEN', `Mission ${id} does not belong to workspace ${workspaceId}`);
    }
  }
  await db.prepare(`DELETE FROM creative_missions WHERE id = ?1`).bind(id).run();
}
