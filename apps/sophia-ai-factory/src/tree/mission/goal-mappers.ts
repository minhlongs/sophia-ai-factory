/**
 * CreativeGoal Row Mappers & Error Primitives
 * @module tree/mission/goal-mappers
 */

import type { CreativeGoal, GoalType } from '@/seed/types/creative-economy';

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

export interface GoalRow {
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

export function rowToDomain(row: GoalRow): CreativeGoal {
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

export function domainToRow(
  g: CreativeGoal,
): Omit<GoalRow, 'created_at' | 'updated_at'> & { created_at: number; updated_at: number } {
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
