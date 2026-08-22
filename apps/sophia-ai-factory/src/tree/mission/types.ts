/**
 * Mission Lifecycle
 * Layer: tree (domain-specific reusable)
 *
 * Sophia's top-level orchestration object.
 * Mission = "Build media business around sustainable living in SEA."
 *
 * Lifecycle: DRAFT → PLANNED → APPROVAL_REQUIRED → RUNNING → PAUSED
 *          → REVIEW → COMPLETED → LEARNING → ITERATING
 *
 * @module tree/mission
 */

import { getD1 } from '@/seed/db/client';
// Mission lifecycle types route through the Creative Economy barrel so the
// canonical contract surface has a single import home. creative-domain.ts
// remains the type author; the barrel re-exports it unchanged.
import type { Mission, CreativeMissionStatus, AutonomyLevel, CreativeGoal } from '@/seed/types/creative-economy';

export class MissionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'MissionError';
    this.code = code;
  }
}

export function newMissionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'msn_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

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

// ── Lifecycle transitions ─────────────────────────────────────────────────────

const NEXT_STATUS: Record<CreativeMissionStatus, CreativeMissionStatus[]> = {
  draft: ['planned'],
  planned: ['approval_required'],
  approval_required: ['running'],
  running: ['paused', 'review', 'completed'],
  paused: ['running', 'review'],
  review: ['completed', 'iterating'],
  completed: ['learning'],
  learning: ['iterating'],
  iterating: ['draft', 'planned', 'running'],
};

export function canTransition(from: CreativeMissionStatus, to: CreativeMissionStatus): boolean {
  return NEXT_STATUS[from]?.includes(to) ?? false;
}

// ── Repository ───────────────────────────────────────────────────────────────

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

  const row = domainToRow(mission);
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
        row.id,
        row.workspace_id,
        row.creator_id,
        row.brand_id,
        row.title,
        row.objective,
        row.audience,
        row.geography,
        row.timeframe_start,
        row.timeframe_end,
        row.budget_cents,
        row.spent_cents,
        row.autonomy_level,
        row.channels,
        row.monetization_goals,
        row.constraints,
        row.success_metrics,
        row.status,
        row.current_phase,
        row.created_at,
        row.updated_at,
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

export async function updateMissionStatus(id: string, newStatus: CreativeMissionStatus, currentPhase: string): Promise<Mission> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  const existing = await getMission(id);
  if (!existing) throw new MissionError('NOT_FOUND', `Mission ${id} not found`);
  if (!canTransition(existing.status, newStatus)) {
    throw new MissionError('INVALID_TRANSITION', `${existing.status} → ${newStatus} not allowed`);
  }
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(`UPDATE creative_missions SET status = ?, current_phase = ?, updated_at = ? WHERE id = ?`)
    .bind(newStatus, currentPhase, now, id)
    .run();
  const updated = await getMission(id);
  if (!updated) throw new MissionError('UPDATE_FAILED', 'Fetch after update failed');
  return updated;
}

export async function recordSpend(id: string, amountCents: number): Promise<void> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  await db.prepare(`UPDATE creative_missions SET spent_cents = spent_cents + ?, updated_at = ? WHERE id = ?`).bind(amountCents, Math.floor(Date.now() / 1000), id).run();
}

export async function deleteMission(id: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  await db.prepare(`DELETE FROM creative_missions WHERE id = ?1`).bind(id).run();
}

// ─── Mission metrics ─────────────────────────────────────────────────────────

export interface MissionMetrics {
  missionId: string;
  budgetCents: number;
  spentCents: number;
  budgetRemainingCents: number;
  spendPercent: number;
  goalCount: number;
  goals: Array<{
    id: string;
    type: string;
    targetMetric: string;
    targetValue: number;
    currentValue: number;
    progressPercent: number;
    status: string;
  }>;
  agentRunCount: number;
  contentProjectCount: number;
  performanceEventCount: number;
  revenueCents: number;
}

/**
 * Aggregate mission metrics from mission, goals, agent runs, content
 * projects, performance events, and revenue into a single snapshot.
 *
 * Uses simple COUNT/SUM aggregations; no throws — returns a zeroed
 * metrics object when the mission does not exist.
 */
export async function getMissionMetrics(missionId: string): Promise<MissionMetrics> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');

  const mission = await getMission(missionId);
  if (!mission) {
    return {
      missionId,
      budgetCents: 0,
      spentCents: 0,
      budgetRemainingCents: 0,
      spendPercent: 0,
      goalCount: 0,
      goals: [],
      agentRunCount: 0,
      contentProjectCount: 0,
      performanceEventCount: 0,
      revenueCents: 0,
    };
  }

  const { getGoalsByMission } = await import('./goal');
  const goals = await getGoalsByMission(missionId);

  const agentRunRow = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM agent_runs WHERE mission_id = ?1`,
    )
    .bind(missionId)
    .first<{ c: number }>();

  const projectRow = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM content_projects WHERE mission_id = ?1`,
    )
    .bind(missionId)
    .first<{ c: number }>();

  const perfRow = await db
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(value_cents), 0) AS rev FROM performance_events WHERE project_id IN (SELECT id FROM content_projects WHERE mission_id = ?1)`,
    )
    .bind(missionId)
    .first<{ c: number; rev: number }>();

  const agentRunCount = agentRunRow?.c ?? 0;
  const contentProjectCount = projectRow?.c ?? 0;
  const performanceEventCount = perfRow?.c ?? 0;
  const revenueCents = perfRow?.rev ?? 0;

  return {
    missionId,
    budgetCents: mission.budgetCents,
    spentCents: mission.spentCents,
    budgetRemainingCents: Math.max(0, mission.budgetCents - mission.spentCents),
    spendPercent: mission.budgetCents > 0
      ? Math.round((mission.spentCents / mission.budgetCents) * 100)
      : 0,
    goalCount: goals.length,
    goals: goals.map((g) => ({
      id: g.id,
      type: g.type,
      targetMetric: g.targetMetric,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      progressPercent: g.targetValue > 0
        ? Math.round((g.currentValue / g.targetValue) * 100)
        : 0,
      status: g.status,
    })),
    agentRunCount,
    contentProjectCount,
    performanceEventCount,
    revenueCents,
  };
}