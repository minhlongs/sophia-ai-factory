/**
 * Mission metrics — aggregate snapshot for a creative mission.
 * Layer: tree (domain-specific reusable)
 *
 * Pure move from types.ts; no logic changes. Aggregates mission, goals,
 * agent runs, content projects, performance events, and revenue into a
 * single snapshot.
 *
 * @module tree/mission/metrics
 */

import { getD1 } from '@/seed/db/client';
import { MissionError } from './types';
import { getMission } from './repository';

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
