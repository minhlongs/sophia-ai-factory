/**
 * CreativeGoal — sub-module of Mission
 * @module tree/mission/goal
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeGoal } from '@/seed/types/creative-economy';
import {
  GoalError,
  newGoalId,
  rowToDomain,
  domainToRow,
  type GoalRow,
} from './goal-mappers';

export { GoalError, newGoalId };

export async function createGoal(goal: CreativeGoal): Promise<CreativeGoal> {
  const db = await getD1();
  if (!db) throw new GoalError('D1_UNAVAILABLE', 'D1 not available');
  const now = Math.floor(Date.now() / 1000);
  goal.id = goal.id || newGoalId();
  goal.createdAt = now;
  goal.updatedAt = now;
  goal.status = goal.status || 'active';
  const row = domainToRow(goal);
  await db
    .prepare(
      `INSERT INTO creative_goals
         (id, workspace_id, mission_id, type, description, target_metric, target_value,
          current_value, timeframe_start, timeframe_end, priority, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id, row.workspace_id, row.mission_id, row.type, row.description,
      row.target_metric, row.target_value, row.current_value,
      row.timeframe_start, row.timeframe_end, row.priority, row.status,
      row.created_at, row.updated_at,
    )
    .run();
  return goal;
}

export async function getGoalsByMission(missionId: string): Promise<CreativeGoal[]> {
  const db = await getD1();
  if (!db) throw new GoalError('D1_UNAVAILABLE', 'D1 not available');
  const result = await db
    .prepare(`SELECT * FROM creative_goals WHERE mission_id = ?1 ORDER BY priority DESC`)
    .bind(missionId)
    .all<GoalRow>();
  return (result.results ?? []).map(rowToDomain);
}

export async function getGoalsByWorkspace(workspaceId: string): Promise<CreativeGoal[]> {
  const db = await getD1();
  if (!db) throw new GoalError('D1_UNAVAILABLE', 'D1 not available');
  const result = await db
    .prepare(`SELECT * FROM creative_goals WHERE workspace_id = ?1 ORDER BY priority DESC`)
    .bind(workspaceId)
    .all<GoalRow>();
  return (result.results ?? []).map(rowToDomain);
}

export async function updateGoalProgress(id: string, currentValue: number): Promise<CreativeGoal> {
  const db = await getD1();
  if (!db) throw new GoalError('D1_UNAVAILABLE', 'D1 not available');
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`UPDATE creative_goals SET current_value = ?, updated_at = ? WHERE id = ?`).bind(currentValue, now, id).run();
  const row = await db.prepare(`SELECT * FROM creative_goals WHERE id = ?1 LIMIT 1`).bind(id).first<GoalRow>();
  if (!row) throw new GoalError('NOT_FOUND', `Goal ${id} not found`);
  return rowToDomain(row);
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new GoalError('D1_UNAVAILABLE', 'D1 not available');
  await db.prepare(`DELETE FROM creative_goals WHERE id = ?1`).bind(id).run();
}
