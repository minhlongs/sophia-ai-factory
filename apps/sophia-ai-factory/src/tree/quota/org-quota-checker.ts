import { createServerClient } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { getOrgQuota } from '@/seed/config/tiers/org-quota-multiplier';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { Tier } from '@/seed/types';
import { logger } from '@/seed/utils/logger-utility';

export {
  checkCredentialQuota,
  checkWebhookQuota,
  checkApiKeyQuota,
} from './org-resource-quota-checkers';

export async function getOrgIdForUser(userId: string): Promise<string | null> {
  try {
    const db = createServerClient();
    return await resolveOrgId(userId, db);
  } catch (error) {
    logger.error('[OrgQuota] getOrgIdForUser failed', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Check campaign quota with org-awareness.
 * If orgId is present, counts campaigns for the org; else per-user.
 */
export async function checkCampaignQuota(
  userId: string,
  orgId: string | null,
  tier: Tier
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const db = createServerClient();
  const query = orgId
    ? db.from('campaigns').select('id').eq('org_id', orgId)
    : db.from('campaigns').select('id').eq('user_id', userId);
  const { data } = await query;
  const current = (data as { id: string }[] | null)?.length ?? 0;

  const limit = orgId ? getOrgQuota(tier).missions : UNIFIED_TIERS[tier].campaignsPerMonth;
  return { allowed: current < limit, current, limit };
}

/**
 * Check org member quota (count members in org).
 * For org context, counts all members in the org. For user-only, returns true (no limit).
 */
export async function checkMemberQuota(
  userId: string,
  orgId: string | null,
  tier: Tier
): Promise<{ allowed: boolean; current: number; limit: number }> {
  if (!orgId) {
    return { allowed: true, current: 0, limit: 0 };
  }
  const db = createServerClient();
  const { data } = await db
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId);
  const current = (data as { user_id: string }[] | null)?.length ?? 0;
  const limit = getOrgQuota(tier).members;
  return { allowed: current < limit, current, limit };
}
