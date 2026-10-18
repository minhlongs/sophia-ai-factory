/**
 * Campaign authorization and quota guard helpers.
 * Layer: app/actions
 * @module app/actions/campaigns-guard-helpers
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { checkMonthlyCampaignLimit } from '@/land/campaigns';
import { tierGuard } from '@/land/tier-guard';
import { createServerClient, getD1, type D1Database } from '@/seed/db/client';
import type { Tier } from '@/seed/types';

export interface CampaignAuthResult {
  userId: string;
  orgId: string;
  d1db: D1Database;
  tier: Tier;
}

export async function authorizeCampaignCreation(): Promise<CampaignAuthResult | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Vui lòng đăng nhập để tạo chiến dịch.' };

  const db = createServerClient();
  const orgId = await resolveOrgId(user.id, db);
  if (!orgId) {
    return { error: 'Forbidden: user is not a member of any organization' };
  }

  const d1db = await getD1();
  if (!d1db) throw new Error('D1 database binding not available');

  const tier = await resolveUserTier(user.id);
  const limitCheck = await checkMonthlyCampaignLimit(user.id, tier);
  if (!limitCheck.allowed) {
    return { error: `Monthly campaign limit reached (${limitCheck.monthLimit}). Upgrade your plan for more.` };
  }

  return { userId: user.id, orgId, d1db, tier };
}

export async function checkMultiChannelAccess(userId: string): Promise<boolean> {
  return tierGuard.checkMultiChannelAccess(userId);
}