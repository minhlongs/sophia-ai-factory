/**
 * OnboardingTracker service managing persistence and lifecycle.
 * @module forest/onboarding/tracker/onboarding-tracker-service
 */

import { createServerClient } from '@/seed/db/client';
import type { OnboardingMilestone, OnboardingProgress } from './types';
import {
  upsertMilestone,
  fetchActiveTenantIds,
  setTenantPauseState,
} from './onboarding-queries';
import {
  buildTenantOnboardingProgress,
  syncTenantOnboardingStatus,
} from './onboarding-progress-builder';

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
    return buildTenantOnboardingProgress(this.db, tenantId);
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
    await syncTenantOnboardingStatus(this.db, progress, tenantId);
  }
}

// Singleton
let trackerInstance: OnboardingTracker | null = null;

export function getOnboardingTracker(): OnboardingTracker {
  if (!trackerInstance) trackerInstance = new OnboardingTracker();
  return trackerInstance;
}
