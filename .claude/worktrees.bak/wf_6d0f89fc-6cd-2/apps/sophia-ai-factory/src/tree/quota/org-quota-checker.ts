import { createServerClient } from '@/seed/db/client';
import { getOrgQuota } from '@/seed/config/tiers/org-quota-multiplier';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { Tier } from '@/seed/types';
import { logger } from '@/seed/utils/logger-utility';

export async function getOrgIdForUser(userId: string): Promise<string | null> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    return (data as { org_id: string } | null)?.org_id ?? null;
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

/**
 * Check credential quota.
 * Credentials are stored in user_provider_credentials (provider, user_id).
 * For org-level, sum across all org members.
 */
export async function checkCredentialQuota(
  userId: string,
  orgId: string | null,
  tier: Tier
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const db = createServerClient();
  if (orgId) {
    // Get all user IDs in org
    const { data: members } = await db
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId);
    const userIds = (members as { user_id: string }[] | null)?.map(m => m.user_id) ?? [];
    if (userIds.length === 0) {
      return { allowed: true, current: 0, limit: getOrgQuota(tier).credentials };
    }
    // Count credentials for all these users
    // D1 doesn't support WHERE user_id IN (...) directly; use OR chain or multiple queries. For simplicity, query all and filter in memory (org sizes are small)
    const { data: allCreds } = await db
      .from('user_provider_credentials')
      .select('user_id');
    const allRows = allCreds as { user_id: string }[] | null;
    const current = allRows?.filter(row => userIds.includes(row.user_id)).length ?? 0;
    const limit = getOrgQuota(tier).credentials;
    return { allowed: current < limit, current, limit };
  } else {
    const { data } = await db
      .from('user_provider_credentials')
      .select('user_id')
      .eq('user_id', userId);
    const current = (data as { user_id: string }[] | null)?.length ?? 0;
    const limit = UNIFIED_TIERS[tier].sopInstallLimit; // per-user default
    return { allowed: current < limit, current, limit };
  }
}

/**
 * Check webhook quota.
 * Webhooks are stored in webhook_endpoints table with tenant_id.
 */
export async function checkWebhookQuota(
  userId: string,
  orgId: string | null,
  tier: Tier
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const db = createServerClient();
  const tenantId = orgId ?? userId;
  const { data } = await db
    .from('webhook_endpoints')
    .select('id')
    .eq('tenant_id', tenantId);
  const current = (data as { id: string }[] | null)?.length ?? 0;
  const limit = orgId ? getOrgQuota(tier).webhooks : (UNIFIED_TIERS[tier].webhooks ? 5 : 0);
  return { allowed: current < limit, current, limit };
}

/**
 * Check API key (raas_licenses) quota.
 */
export async function checkApiKeyQuota(
  userId: string,
  orgId: string | null,
  tier: Tier
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const db = createServerClient();
  if (orgId) {
    // Get all user IDs in the org
    const { data: members } = await db
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId);
    const userIds = (members as { user_id: string }[] | null)?.map(m => m.user_id) ?? [];
    if (userIds.length === 0) {
      return { allowed: true, current: 0, limit: getOrgQuota(tier).apiKeys };
    }
    // Count active raas_licenses for these users
    // Since D1 lacks IN, we'll fetch all and filter in memory (orgs are small)
    const { data: allKeys } = await db
      .from('raas_licenses')
      .select('user_id')
      .eq('is_revoked', 0);
    const allRows = allKeys as { user_id: string }[] | null;
    const current = allRows?.filter(row => userIds.includes(row.user_id)).length ?? 0;
    const limit = getOrgQuota(tier).apiKeys;
    return { allowed: current < limit, current, limit };
  } else {
    const { data } = await db
      .from('raas_licenses')
      .select('id')
      .eq('user_id', userId)
      .eq('is_revoked', 0);
    const current = (data as { id: string }[] | null)?.length ?? 0;
    const limit = getOrgQuota(tier).apiKeys;
    return { allowed: current < limit, current, limit };
  }
}
