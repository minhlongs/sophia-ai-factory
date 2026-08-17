/**
 * CreativeGoal — sub-module of Mission
 * @module tree/mission/goal
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeGoal, GoalType } from '@/seed/types/creative-domain';

export class GoalError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'GoalError';
    this.code = code;
  }
}

export function newGoalId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'goal_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface GoalRow {
  id: string;
  workspace_id: string;
  mission_id: string | null;
  type: string;
  description: string;
  target_metric: string;
  target_value: number;
  current_value: number;
  timeframe_start: number;
  timeframe_end: number;
  priority: number;
  status: string;
  created_at: number;
  updated_at: number;
}

function rowToDomain(row: GoalRow): CreativeGoal {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    missionId: row.mission_id ?? undefined,
    type: row.type as GoalType,
    description: row.description,
    targetMetric: row.target_metric,
    targetValue: row.target_value,
    currentValue: row.current_value,
    timeframeStart: row.timeframe_start,
    timeframeEnd: row.timeframe_end,
    priority: row.priority,
    status: row.status as CreativeGoal['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function domainToRow(g: CreativeGoal): Omit<GoalRow, 'created_at' | 'updated_at'> & { created_at: number; updated_at: number } {
  return {
    id: g.id,
    workspace_id: g.workspaceId,
    mission_id: g.missionId ?? null,
    type: g.type,
    description: g.description,
    target_metric: g.targetMetric,
    target_value: g.targetValue,
    current_value: g.currentValue,
    timeframe_start: g.timeframeStart,
    timeframe_end: g.timeframeEnd,
    priority: g.priority,
    status: g.status,
    created_at: g.createdAt,
    updated_at: g.updatedAt,
  };
}

export async function createGoal(goal: CreativeGoal): Promise<CreativeGoal> {
  const db = getD1();
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
  const db = getD1();
  if (!db) throw new GoalError('D1_UNAVAILABLE', 'D1 not available');
  const result = await db
    .prepare(`SELECT * FROM creative_goals WHERE mission_id = ?1 ORDER BY priority DESC`)
    .bind(missionId)
    .all<GoalRow>();
  return (result.results ?? []).map(rowToDomain);
}

export async function getGoalsByWorkspace(workspaceId: string): Promise<CreativeGoal[]> {
  const db = getD1();
  if (!db) throw new GoalError('D1_UNAVAILABLE', 'D1 not available');
  const result = await db
    .prepare(`SELECT * FROM creative_goals WHERE workspace_id = ?1 ORDER BY priority DESC`)
    .bind(workspaceId)
    .all<GoalRow>();
  return (result.results ?? []).map(rowToDomain);
}

export async function updateGoalProgress(id: string, currentValue: number): Promise<CreativeGoal> {
  const db = getD1();
  if (!db) throw new GoalError('D1_UNAVAILABLE', 'D1 not available');
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`UPDATE creative_goals SET current_value = ?, updated_at = ? WHERE id = ?`).bind(currentValue, now, id).run();
  const row = await db.prepare(`SELECT * FROM creative_goals WHERE id = ?1 LIMIT 1`).bind(id).first<GoalRow>();
  if (!row) throw new GoalError('NOT_FOUND', `Goal ${id} not found`);
  return rowToDomain(row);
}

export async function deleteGoal(id: string): Promise<void> {
  const db = getD1();
  if (!db) throw new GoalError('D1_UNAVAILABLE', 'D1 not available');
  await db.prepare(`DELETE FROM creative_goals WHERE id = ?1`).bind(id).run();
}