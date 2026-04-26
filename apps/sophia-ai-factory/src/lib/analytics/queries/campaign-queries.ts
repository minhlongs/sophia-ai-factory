/**
 * Analytics - Campaign / License Metrics Queries
 *
 * Fetches license status data, tier breakdown, and per-license utilization.
 * Named "campaign-queries" because licenses map to campaigns in the RaaS model.
 */

import { createServerClient } from '@/lib/db/client';
import type { D1QueryChain } from '@/lib/db/d1-query-chain';
import { logger } from '@/lib/utils/logger-utility';
import type { LicenseFilters, LicenseMetrics, LicenseUtilization } from '../types';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';

interface LicenseRow { nonce: string; tier: string; expires_at: number | null; is_revoked: boolean }
interface UsageRow { credits_used: number | null }
interface OverageRow { exceeded_by: number | null; billable: boolean | null }

/**
 * Fetch license metrics from Supabase
 *
 * @param filters - Query filters for license data
 */
export async function fetchLicenseMetrics(filters: LicenseFilters = {}): Promise<LicenseMetrics> {
  const db = createServerClient();
  const status = filters.status || 'active';

  let query: D1QueryChain = db.from('raas_licenses').select('*');

  // Apply status filter — D1QueryChain has no .or(), so 'active' fetches non-revoked then filters client-side
  const now = Math.floor(Date.now() / 1000);
  if (status !== 'all') {
    switch (status) {
      case 'active':
        query = query.eq('is_revoked', false);
        break;
      case 'expired':
        query = query.eq('is_revoked', false).lt('expires_at', now);
        break;
      case 'revoked':
        query = query.eq('is_revoked', true);
        break;
    }
  }

  if (filters.tier) {
    query = query.eq('tier', filters.tier);
  }

  const { data: rawLicenses, error } = await query;

  if (error) {
    logger.error('[Analytics] Failed to fetch licenses', error);
    throw new Error('Failed to fetch license data');
  }

  if (!rawLicenses || rawLicenses.length === 0) {
    return { total: 0, byTier: {}, utilization: [] };
  }

  // Client-side filter: active = not revoked AND (no expiry OR not yet expired)
  const licenses = (status === 'active'
    ? (rawLicenses as LicenseRow[]).filter(l => !l.expires_at || l.expires_at > now)
    : rawLicenses as LicenseRow[]
  );

  // Calculate byTier counts
  const byTier: Record<string, number> = {};
  for (const license of licenses) {
    const tier = license.tier || 'BASIC';
    byTier[tier] = (byTier[tier] || 0) + 1;
  }

  // Calculate utilization for each license
  const utilization: LicenseUtilization[] = [];
  const monthStart = Math.floor(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
  );

  for (const license of licenses) {
    const quota = QUOTA_LIMITS[license.tier] || QUOTA_LIMITS.BASIC;

    const { data: usageData } = await db
      .from('usage_events')
      .select('credits_used')
      .eq('license_nonce', license.nonce)
      .gte('created_at', monthStart);

    const usedCredits = (usageData as UsageRow[] | null)?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0;
    const limitCredit = quota.monthlyCredits;
    const percentage = limitCredit > 0
      ? Math.round((usedCredits / limitCredit) * 10000) / 100
      : 0;

    const { data: overageData } = await db
      .from('overage_events')
      .select('exceeded_by, billable')
      .eq('license_nonce', license.nonce)
      .gte('created_at', monthStart);

    const typedOverage = overageData as OverageRow[] | null;
    const overageCount = typedOverage?.length || 0;
    const billableCount = typedOverage?.filter(e => e.billable).length || 0;
    const overageCredits = typedOverage?.reduce((sum, e) => sum + (e.exceeded_by || 0), 0) || 0;

    utilization.push({
      licenseNonce: license.nonce,
      tier: license.tier || 'BASIC',
      usedCredits,
      limitCredit,
      percentage: Math.min(percentage, 100),
      expiresAt: license.expires_at,
      overageCount,
      billableCount,
      overageCredits,
    });
  }

  return {
    total: licenses.length,
    byTier,
    utilization: utilization.sort((a, b) => b.percentage - a.percentage),
  };
}
