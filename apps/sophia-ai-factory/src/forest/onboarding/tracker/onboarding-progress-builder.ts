/**
 * Helper builders for tenant onboarding progress calculation and status sync.
 * @module forest/onboarding/tracker/onboarding-progress-builder
 */

import type { createServerClient } from '@/seed/db/client';
import type { OnboardingProgress, OnboardingStatus } from './types';
import {
  calculateProgressPct,
  daysBetween,
  determinePhase,
  evaluateMilestoneStatus,
  evaluateAtRiskFlags,
} from './milestone-evaluator';
import {
  fetchMilestoneRecords,
  updateTenantRecord,
  isTenantPaused,
  countRecentActivity,
} from './onboarding-queries';

type D1Client = ReturnType<typeof createServerClient>;

const STATUS_MAP: Record<OnboardingStatus, string> = {
  not_started: 'not_started',
  in_progress: 'in_progress',
  at_risk: 'at_risk',
  completed: 'completed',
  paused: 'paused',
};

export async function buildTenantOnboardingProgress(
  db: D1Client,
  tenantId: string,
): Promise<OnboardingProgress | null> {
  try {
    const records = await fetchMilestoneRecords(db, tenantId);
    if (records.length === 0) return null;

    const startedAt = records[0]?.achievedAt ?? new Date().toISOString();
    const completedAt = records.find((r) => r.milestone === 'retro_completed')?.achievedAt;
    const tenantPaused = await isTenantPaused(db, tenantId);
    const status = evaluateMilestoneStatus(records, startedAt, tenantPaused, completedAt);
    const currentPhase = determinePhase(records);
    const daysElapsed = daysBetween(startedAt, new Date().toISOString());
    const loginCount = await countRecentActivity(db, tenantId);
    const atRiskFlags = evaluateAtRiskFlags(records, daysElapsed, loginCount);

    return {
      tenantId,
      status,
      startedAt,
      completedAt,
      milestones: records,
      currentPhase,
      daysElapsed,
      daysRemaining: Math.max(0, 14 - daysElapsed),
      atRiskFlags,
    };
  } catch {
    return null;
  }
}

export async function syncTenantOnboardingStatus(
  db: D1Client,
  progress: OnboardingProgress | null,
  tenantId: string,
): Promise<void> {
  if (!progress) return;

  await updateTenantRecord(
    db,
    tenantId,
    STATUS_MAP[progress.status],
    calculateProgressPct(progress.milestones),
  );
}
