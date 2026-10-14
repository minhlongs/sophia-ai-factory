/**
 * Mission Repository Row Mapping and Database Types
 *
 * Layer: tree/mission
 */

import type { Mission, CreativeMissionStatus, AutonomyLevel } from '@/seed/types/creative-economy';

export interface MissionRow {
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

export function rowToDomain(row: MissionRow): Mission {
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

export function domainToRow(m: Mission): Omit<MissionRow, 'created_at' | 'updated_at'> & { created_at: number; updated_at: number } {
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
