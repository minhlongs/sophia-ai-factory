/**
 * Onboarding Status Tracker
 *
 * Tracks customer onboarding progress through the 14-day SOP.
 * Uses D1Client (Supabase-compatible API) per codebase convention.
 *
 * Usage:
 *   const tracker = getOnboardingTracker();
 *   await tracker.recordMilestone(tenantId, 'first_post_published');
 *   const status = await tracker.getProgress(tenantId);
 */

import { createServerClient } from '@/seed/db/client';

export type OnboardingMilestone =
  | 'contract_signed'
  | 'welcome_email_sent'
  | 'kickoff_scheduled'
  | 'kickoff_completed'
  | 'discovery_completed'
  | 'channels_connected'
  | 'brand_assets_loaded'
  | 'first_post_published'
  | 'first_report_delivered'
  | 'team_trained'
  | 'retro_completed';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'at_risk' | 'completed' | 'paused';

export interface MilestoneRecord {
  milestone: OnboardingMilestone;
  achievedAt: string;
  achievedBy: string;
  notes?: string;
}

export interface OnboardingProgress {
  tenantId: string;
  status: OnboardingStatus;
  startedAt: string;
  completedAt?: string;
  milestones: MilestoneRecord[];
  currentPhase: number;
  daysElapsed: number;
  daysRemaining: number;
  atRiskFlags: string[];
}

const MILESTONE_SEQUENCE: OnboardingMilestone[] = [
  'contract_signed',
  'welcome_email_sent',
  'kickoff_scheduled',
  'kickoff_completed',
  'discovery_completed',
  'channels_connected',
  'brand_assets_loaded',
  'first_post_published',
  'first_report_delivered',
  'team_trained',
  'retro_completed',
];

const _PHASE_MILESTONES: Record<number, OnboardingMilestone[]> = {
  1: ['contract_signed', 'welcome_email_sent', 'kickoff_scheduled', 'kickoff_completed', 'discovery_completed'],
  2: ['channels_connected', 'brand_assets_loaded'],
  3: ['first_post_published', 'first_report_delivered', 'team_trained', 'retro_completed'],
};

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
      const now = new Date().toISOString();
      await this.db
        .from('onboarding_progress')
        .upsert({
          tenant_id: tenantId,
          milestone,
          achieved_at: now,
          achieved_by: achievedBy,
          notes: notes ?? null,
        });

      await this.updateTenantStatus(tenantId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Get full onboarding progress for a tenant */
  async getProgress(tenantId: string): Promise<OnboardingProgress | null> {
    try {
      const { data: milestones } = await this.db
        .from<{ milestone: string; achieved_at: string; achieved_by: string; notes: string | null }>(
          'onboarding_progress',
        )
        .select('milestone, achieved_at, achieved_by, notes')
        .eq('tenant_id', tenantId)
        .order('achieved_at');

      if (!milestones || milestones.length === 0) return null;

      const records: MilestoneRecord[] = milestones.map((m) => ({
        milestone: m.milestone as OnboardingMilestone,
        achievedAt: m.achieved_at,
        achievedBy: m.achieved_by,
        notes: m.notes ?? undefined,
      }));

      const startedAt = records[0]?.achievedAt ?? new Date().toISOString();
      const completedAt = records.find((r) => r.milestone === 'retro_completed')?.achievedAt;
      const status = await this.determineStatus(tenantId, records, startedAt, completedAt);
      const currentPhase = this.determinePhase(records);
      const daysElapsed = this.daysBetween(startedAt, new Date().toISOString());
      const atRiskFlags = await this.detectAtRisk(tenantId, records, daysElapsed);

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
      const { data: rows } = await this.db
        .from<{ tenant_id: string }>('onboarding_progress')
        .select('tenant_id')
        .gte('achieved_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

      if (!rows || rows.length === 0) return [];

      const seen = new Set<string>();
      const results: OnboardingProgress[] = [];
      for (const row of rows) {
        if (seen.has(row.tenant_id)) continue;
        seen.add(row.tenant_id);
        const progress = await this.getProgress(row.tenant_id);
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
    try {
      await this.db.from('tenants').update({ onboarding_status: 'paused', onboarding_paused_reason: reason }).eq('id', tenantId);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /** Resume paused onboarding */
  async resume(tenantId: string): Promise<{ success: boolean }> {
    try {
      await this.db
        .from('tenants')
        .update({ onboarding_status: 'in_progress', onboarding_paused_reason: null })
        .eq('id', tenantId);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // -- Private helpers --

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

    await this.db
      .from('tenants')
      .update({
        onboarding_status: statusMap[progress.status],
        onboarding_progress_pct: this.calculateProgressPct(progress.milestones),
      })
      .eq('id', tenantId);
  }

  private async determineStatus(
    tenantId: string,
    records: MilestoneRecord[],
    startedAt: string,
    completedAt?: string,
  ): Promise<OnboardingStatus> {
    if (completedAt) return 'completed';

    const achieved = new Set(records.map((r) => r.milestone));
    const daysElapsed = this.daysBetween(startedAt, new Date().toISOString());

    try {
      const { data: tenant } = await this.db
        .from<{ onboarding_status: string }>('tenants')
        .select('onboarding_status')
        .eq('id', tenantId)
        .maybeSingle();
      if (tenant?.onboarding_status === 'paused') return 'paused';
    } catch {
      // table may not have column yet
    }

    if (daysElapsed > 14) return 'at_risk';
    if (daysElapsed > 10 && !achieved.has('first_post_published')) return 'at_risk';
    if (daysElapsed > 7 && !achieved.has('channels_connected')) return 'at_risk';
    if (daysElapsed > 4 && !achieved.has('discovery_completed')) return 'at_risk';

    return 'in_progress';
  }

  private determinePhase(records: MilestoneRecord[]): number {
    const achieved = new Set(records.map((r) => r.milestone));
    if (achieved.has('retro_completed') || achieved.has('first_post_published')) return 3;
    if (achieved.has('channels_connected')) return 2;
    return 1;
  }

  private async detectAtRisk(
    tenantId: string,
    records: MilestoneRecord[],
    daysElapsed: number,
  ): Promise<string[]> {
    const flags: string[] = [];
    const achieved = new Set(records.map((r) => r.milestone));

    if (daysElapsed > 10 && !achieved.has('first_post_published')) flags.push('first_post_missed');
    if (daysElapsed > 7 && !achieved.has('channels_connected')) flags.push('channels_not_connected');
    if (daysElapsed > 4 && !achieved.has('discovery_completed')) flags.push('discovery_overdue');
    if (daysElapsed > 3 && !achieved.has('kickoff_completed')) flags.push('kickoff_missed');

    // Check login activity (raw D1 — COUNT not in D1QueryChain)
    try {
      const raw = this.db.unwrap();
      const { cnt } = (await raw
        .prepare(
          `SELECT COUNT(*) as cnt FROM user_activity
           WHERE user_id = (SELECT user_id FROM tenants WHERE id = ? LIMIT 1)
           AND created_at >= datetime('now', '-7 days')`,
        )
        .bind(tenantId)
        .first<{ cnt: number }>()) ?? { cnt: 0 };
      if (cnt === 0) flags.push('no_login_7_days');
    } catch {
      // table may not exist
    }

    return flags;
  }

  private calculateProgressPct(milestones: MilestoneRecord[]): number {
    const achieved = new Set(milestones.map((r) => r.milestone));
    const done = MILESTONE_SEQUENCE.filter((m) => achieved.has(m)).length;
    return Math.round((done / MILESTONE_SEQUENCE.length) * 100);
  }

  private daysBetween(start: string, end: string): number {
    return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
  }
}

// Singleton
let trackerInstance: OnboardingTracker | null = null;

export function getOnboardingTracker(): OnboardingTracker {
  if (!trackerInstance) trackerInstance = new OnboardingTracker();
  return trackerInstance;
}
