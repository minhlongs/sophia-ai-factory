/**
 * Database queries and persistence operations for onboarding tracker.
 * @module forest/onboarding/tracker/onboarding-queries
 */

import type { createServerClient } from '@/seed/db/client';
import type { MilestoneRecord, OnboardingMilestone } from './types';

type D1Client = ReturnType<typeof createServerClient>;

export async function upsertMilestone(
  db: D1Client,
  tenantId: string,
  milestone: OnboardingMilestone,
  achievedBy: string,
  notes?: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.from('onboarding_progress').upsert({
    tenant_id: tenantId,
    milestone,
    achieved_at: now,
    achieved_by: achievedBy,
    notes: notes ?? null,
  });
}

export async function fetchMilestoneRecords(
  db: D1Client,
  tenantId: string,
): Promise<MilestoneRecord[]> {
  const { data: milestones } = await db
    .from<{ milestone: string; achieved_at: string; achieved_by: string; notes: string | null }>(
      'onboarding_progress',
    )
    .select('milestone, achieved_at, achieved_by, notes')
    .eq('tenant_id', tenantId)
    .order('achieved_at');

  if (!milestones || milestones.length === 0) return [];

  return milestones.map((m) => ({
    milestone: m.milestone as OnboardingMilestone,
    achievedAt: m.achieved_at,
    achievedBy: m.achieved_by,
    notes: m.notes ?? undefined,
  }));
}

export async function fetchActiveTenantIds(
  db: D1Client,
  lookbackDays = 14,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await db
    .from<{ tenant_id: string }>('onboarding_progress')
    .select('tenant_id')
    .gte('achieved_at', cutoff);

  if (!rows || rows.length === 0) return [];
  const seen = new Set<string>();
  for (const row of rows) {
    seen.add(row.tenant_id);
  }
  return Array.from(seen);
}

export async function updateTenantRecord(
  db: D1Client,
  tenantId: string,
  status: string,
  progressPct: number,
): Promise<void> {
  await db
    .from('tenants')
    .update({
      onboarding_status: status,
      onboarding_progress_pct: progressPct,
    })
    .eq('id', tenantId);
}

export async function isTenantPaused(db: D1Client, tenantId: string): Promise<boolean> {
  try {
    const { data: tenant } = await db
      .from<{ onboarding_status: string }>('tenants')
      .select('onboarding_status')
      .eq('id', tenantId)
      .maybeSingle();
    return tenant?.onboarding_status === 'paused';
  } catch {
    return false;
  }
}

export async function countRecentActivity(db: D1Client, tenantId: string): Promise<number> {
  try {
    const raw = db.unwrap();
    const { cnt } = (await raw
      .prepare(
        `SELECT COUNT(*) as cnt FROM user_activity
         WHERE user_id = (SELECT user_id FROM tenants WHERE id = ? LIMIT 1)
         AND created_at >= datetime('now', '-7 days')`,
      )
      .bind(tenantId)
      .first<{ cnt: number }>()) ?? { cnt: 0 };
    return cnt;
  } catch {
    return -1;
  }
}

export async function setTenantPauseState(
  db: D1Client,
  tenantId: string,
  isPaused: boolean,
  reason?: string,
): Promise<boolean> {
  try {
    await db
      .from('tenants')
      .update({
        onboarding_status: isPaused ? 'paused' : 'in_progress',
        onboarding_paused_reason: isPaused ? (reason ?? null) : null,
      })
      .eq('id', tenantId);
    return true;
  } catch {
    return false;
  }
}
