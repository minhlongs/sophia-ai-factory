/**
 * Analytics - Campaign / License Metrics Queries
 *
 * Fetches license status data, tier breakdown, and per-license utilization.
 * Named "campaign-queries" because licenses map to campaigns in the RaaS model.
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { LicenseFilters, LicenseMetrics, LicenseUtilization } from '../types';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';

/**
 * Fetch license metrics from Supabase
 *
 * @param filters - Query filters for license data
 */
export async function fetchLicenseMetrics(filters: LicenseFilters = {}): Promise<LicenseMetrics> {
  const db = createServerClient();
  const status = filters.status || 'active';

  let query: any = db.from('raas_licenses').select('*');

  // Apply status filter
  const now = Math.floor(Date.now() / 1000);
  if (status !== 'all') {
    switch (status) {
      case 'active':
        query = query.eq('is_revoked', false).or(`expires_at.is.null,expires_at.gt.${now}`);
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

  const { data: licenses, error } = await query as any;

  if (error) {
    logger.error('[Analytics] Failed to fetch licenses', error);
    throw new Error('Failed to fetch license data');
  }

  if (!licenses || licenses.length === 0) {
    return { total: 0, byTier: {}, utilization: [] };
  }

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

    const usedCredits = (usageData as any[])?.reduce((sum: number, r: any) => sum + (r.credits_used || 0), 0) || 0;
    const limitCredit = quota.monthlyCredits;
    const percentage = limitCredit > 0
      ? Math.round((usedCredits / limitCredit) * 10000) / 100
      : 0;

    const { data: overageData } = await db
      .from('overage_events')
      .select('exceeded_by, billable')
      .eq('license_nonce', license.nonce)
      .gte('created_at', monthStart);

    const overageCount = (overageData as any[])?.length || 0;
    const billableCount = (overageData as any[])?.filter((e: any) => e.billable).length || 0;
    const overageCredits = (overageData as any[])?.reduce((sum: number, e: any) => sum + (e.exceeded_by || 0), 0) || 0;

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
