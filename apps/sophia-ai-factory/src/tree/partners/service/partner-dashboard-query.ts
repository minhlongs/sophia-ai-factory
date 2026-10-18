/**
 * Partner Dashboard Data Aggregator Query
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/partner-dashboard-query
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerDashboardData,
  PartnerCommission,
} from '@/tree/partners/types';
import { calculateNextTierProgress } from './commission-math';
import { getPartnerById } from './partner-profile';
import { getWhitelabelConfigByPartnerId } from './whitelabel-config';

/**
 * Aggregates complete partner dashboard metrics, commissions, and progress.
 */
export async function getPartnerDashboardData(
  db: D1Database,
  partnerId: string,
): Promise<PartnerDashboardData> {
  const profile = await getPartnerById(db, partnerId);
  if (!profile) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const whitelabelConfig = await getWhitelabelConfigByPartnerId(db, partnerId);

  const commissionsResult = await db
    .prepare(
      `SELECT * FROM partner_commissions
       WHERE partner_id = ?1
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .bind(partnerId)
    .all<PartnerCommission>();

  const nextTier = calculateNextTierProgress(
    profile.tier,
    profile.total_referred_customers,
    profile.total_mrr_cents,
  );

  return {
    profile,
    whitelabelConfig,
    recentCommissions: commissionsResult.results ?? [],
    nextTier,
  };
}
