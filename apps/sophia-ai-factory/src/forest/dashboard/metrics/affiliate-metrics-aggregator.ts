/**
 * @module forest/dashboard/metrics/affiliate-metrics-aggregator
 * Affiliate commission metrics aggregations.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { DashboardResult, AffiliateStats } from './types';

/**
 * Fetch top affiliate partners by commission
 */
export async function fetchTopAffiliates(
  userId: string,
  limit: number = 5
): Promise<DashboardResult<AffiliateStats[]>> {
  try {
    const db = createServerClient();

    const result = await db
      .from('affiliates')
      .select('id, name, initials, avatar_url, stats, total_commission')
      .eq('user_id', userId)
      .order('total_commission', { ascending: false })
      .limit(limit);

    if (result.error || !result.data) {
      return { ok: true, data: [] };
    }

    const affiliates = (
      result.data as Array<{
        id: string;
        name: string;
        initials: string;
        avatar_url: string | null;
        stats: string;
        total_commission: number;
      }>
    ).map((aff) => ({
      id: aff.id,
      name: aff.name,
      initials: aff.initials,
      avatar: aff.avatar_url,
      stats: aff.stats,
      commission: `+$${aff.total_commission.toFixed(0)}`,
    }));

    return { ok: true, data: affiliates };
  } catch (error) {
    logger.warn('[dashboard] Could not fetch affiliates', toError(error));
    return { ok: true, data: [] };
  }
}
