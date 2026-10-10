/**
 * OnboardingTracker service managing persistence and lifecycle.
 * @module forest/onboarding/tracker/onboarding-tracker-service
 */

import { createServerClient } from '@/seed/db/client';
import type {
  OnboardingMilestone,
  OnboardingProgress,
  OnboardingStatus,
} from './types';
import {
  calculateProgressPct,
  daysBetween,
  determinePhase,
  evaluateMilestoneStatus,
  evaluateAtRiskFlags,
} from './milestone-evaluator';
import {
  upsertMilestone,
  fetchMilestoneRecords,
  fetchActiveTenantIds,
  updateTenantRecord,
  isTenantPaused,
  countRecentActivity,
  setTenantPauseState,
} from './onboarding-queries';

export class OnboardingTracker {
  private db = createServerClient();

  /** Record a milestone achievement for a tenant */
  async recordMilestone(
    tenantId: string,
    milestone: OnboardingMilestone,
    achievedBy: string,
    notes?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await upsertMilestone(this.db, tenantId, milestone, achievedBy, notes);
      await this.updateTenantStatus(tenantId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Get full onboarding progress for a tenant */
  async getProgress(tenantId: string): Promise<OnboardingProgress | null> {
    try {
      const records = await fetchMilestoneRecords(this.db, tenantId);
      if (records.length === 0) return null;

      const startedAt = records[0]?.achievedAt ?? new Date().toISOString();
      const completedAt = records.find((r) => r.milestone === 'retro_completed')?.achievedAt;
      const tenantPaused = await isTenantPaused(this.db, tenantId);
      const status = evaluateMilestoneStatus(records, startedAt, tenantPaused, completedAt);
      const currentPhase = determinePhase(records);
      const daysElapsed = daysBetween(startedAt, new Date().toISOString());
      const loginCount = await countRecentActivity(this.db, tenantId);
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

  /** Get all tenants currently in onboarding */
  async getAllActive(): Promise<OnboardingProgress[]> {
    try {
      const tenantIds = await fetchActiveTenantIds(this.db);
      const results: OnboardingProgress[] = [];
      for (const tenantId of tenantIds) {
        const progress = await this.getProgress(tenantId);
        if (progress && progress.status !== 'completed') {
          results.push(progress);
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  /** Get at-risk tenants for AM attention */
  async getAtRisk(): Promise<OnboardingProgress[]> {
    const all = await this.getAllActive();
    return all.filter((p) => p.status === 'at_risk');
  }

  /** Mark onboarding as paused */
  async pause(tenantId: string, reason: string): Promise<{ success: boolean }> {
    const ok = await setTenantPauseState(this.db, tenantId, true, reason);
    return { success: ok };
  }

  /** Resume paused onboarding */
  async resume(tenantId: string): Promise<{ success: boolean }> {
    const ok = await setTenantPauseState(this.db, tenantId, false);
    return { success: ok };
  }

  private async updateTenantStatus(tenantId: string): Promise<void> {
    const progress = await this.getProgress(tenantId);
    if (!progress) return;

    const statusMap: Record<OnboardingStatus, string> = {
      not_started: 'not_started',
      in_progress: 'in_progress',
      at_risk: 'at_risk',
      completed: 'completed',
      paused: 'paused',
    };

    await updateTenantRecord(
      this.db,
      tenantId,
      statusMap[progress.status],
      calculateProgressPct(progress.milestones),
    );
  }
}

// Singleton
let trackerInstance: OnboardingTracker | null = null;

export function getOnboardingTracker(): OnboardingTracker {
  if (!trackerInstance) trackerInstance = new OnboardingTracker();
  return trackerInstance;
}
