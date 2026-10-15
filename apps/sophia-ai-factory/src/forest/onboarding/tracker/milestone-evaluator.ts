/**
 * Pure evaluation logic for onboarding phases, risks, and progress metrics.
 * @module forest/onboarding/tracker/milestone-evaluator
 */

import { MILESTONE_SEQUENCE, type MilestoneRecord, type OnboardingStatus } from './types';

export function calculateProgressPct(milestones: MilestoneRecord[]): number {
  const achieved = new Set(milestones.map((r) => r.milestone));
  const done = MILESTONE_SEQUENCE.filter((m) => achieved.has(m)).length;
  return Math.round((done / MILESTONE_SEQUENCE.length) * 100);
}

export function daysBetween(start: string, end: string): number {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
}

export function determinePhase(records: MilestoneRecord[]): number {
  const achieved = new Set(records.map((r) => r.milestone));
  if (achieved.has('retro_completed') || achieved.has('first_post_published')) return 3;
  if (achieved.has('channels_connected')) return 2;
  return 1;
}

export function evaluateMilestoneStatus(
  records: MilestoneRecord[],
  startedAt: string,
  tenantPaused: boolean,
  completedAt?: string,
): OnboardingStatus {
  if (completedAt) return 'completed';
  if (tenantPaused) return 'paused';

  const achieved = new Set(records.map((r) => r.milestone));
  const daysElapsed = daysBetween(startedAt, new Date().toISOString());

  if (daysElapsed > 14) return 'at_risk';
  if (daysElapsed > 10 && !achieved.has('first_post_published')) return 'at_risk';
  if (daysElapsed > 7 && !achieved.has('channels_connected')) return 'at_risk';
  if (daysElapsed > 4 && !achieved.has('discovery_completed')) return 'at_risk';

  return 'in_progress';
}

export function evaluateAtRiskFlags(
  records: MilestoneRecord[],
  daysElapsed: number,
  loginCountLast7Days: number,
): string[] {
  const flags: string[] = [];
  const achieved = new Set(records.map((r) => r.milestone));

  if (daysElapsed > 10 && !achieved.has('first_post_published')) flags.push('first_post_missed');
  if (daysElapsed > 7 && !achieved.has('channels_connected')) flags.push('channels_not_connected');
  if (daysElapsed > 4 && !achieved.has('discovery_completed')) flags.push('discovery_overdue');
  if (daysElapsed > 3 && !achieved.has('kickoff_completed')) flags.push('kickoff_missed');

  if (loginCountLast7Days === 0) {
    flags.push('no_login_7_days');
  }

  return flags;
}
