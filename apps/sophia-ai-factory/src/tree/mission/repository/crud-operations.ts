/**
 * Mission Repository CRUD Operations
 *
 * Layer: tree/mission
 */

import { getD1 } from '@/seed/db/client';
import type { Mission, CreativeMissionStatus, CreativeGoal } from '@/seed/types/creative-economy';
import { MissionError, newMissionId } from '../types';
import { rowToDomain, domainToRow, type MissionRow } from './types';

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
  const { getGoalsByMission } = await import('../goal');
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
