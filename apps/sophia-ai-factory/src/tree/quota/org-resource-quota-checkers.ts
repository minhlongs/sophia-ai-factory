/**
 * Organization Credential, Webhook, and API Key Quota Checkers
 *
 * Layer: tree/quota
 */

import { createServerClient } from '@/seed/db/client';
import { getOrgQuota } from '@/seed/config/tiers/org-quota-multiplier';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { Tier } from '@/seed/types';

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
    const { data: members } = await db
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId);
    const userIds = (members as { user_id: string }[] | null)?.map(m => m.user_id) ?? [];
    if (userIds.length === 0) {
      return { allowed: true, current: 0, limit: getOrgQuota(tier).credentials };
    }
    const { data: allCreds } = await db
      .from('user_provider_credentials')
      .select('user_id');
    const allRows = allCreds as { user_id: string }[] | null;
    const current = allRows?.filter(row => userIds.includes(row.user_id)).length ?? 0;
    const limit = getOrgQuota(tier).credentials;
    return { allowed: current < limit, current, limit };
  }

  const { data } = await db
    .from('user_provider_credentials')
    .select('user_id')
    .eq('user_id', userId);
  const current = (data as { user_id: string }[] | null)?.length ?? 0;
  const limit = UNIFIED_TIERS[tier].sopInstallLimit;
  return { allowed: current < limit, current, limit };
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
    const { data: members } = await db
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId);
    const userIds = (members as { user_id: string }[] | null)?.map(m => m.user_id) ?? [];
    if (userIds.length === 0) {
      return { allowed: true, current: 0, limit: getOrgQuota(tier).apiKeys };
    }
    const { data: allKeys } = await db
      .from('raas_licenses')
      .select('user_id')
      .eq('is_revoked', 0);
    const allRows = allKeys as { user_id: string }[] | null;
    const current = allRows?.filter(row => userIds.includes(row.user_id)).length ?? 0;
    const limit = getOrgQuota(tier).apiKeys;
    return { allowed: current < limit, current, limit };
  }

  const { data } = await db
    .from('raas_licenses')
    .select('id')
    .eq('user_id', userId)
    .eq('is_revoked', 0);
  const current = (data as { id: string }[] | null)?.length ?? 0;
  const limit = getOrgQuota(tier).apiKeys;
  return { allowed: current < limit, current, limit };
}
