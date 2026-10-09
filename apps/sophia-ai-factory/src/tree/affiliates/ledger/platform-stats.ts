/**
 * Affiliate Ledger Submodule: Platform Aggregate Stats.
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/platform-stats
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type { AffiliateLedgerStats } from '@/seed/types/affiliate';
import { resolveD1 } from './db-resolver';
import type { RawPartnerStatsRow, RawCommissionStatsRow } from './types';

/**
 * Returns platform-wide aggregate stats across all affiliate partners and commissions.
 * Used by /api/affiliates/stats and dashboard summary cards.
 */
export async function getAffiliateLedgerStats(
  customD1?: D1Database
): Promise<AffiliateLedgerStats> {
  const d1 = await resolveD1(customD1);
  if (!d1) {
    return {
      totalAffiliates: 0,
      activeAffiliates: 0,
      totalCommissionCents: 0,
      pendingCommissionCents: 0,
      settledCommissionCents: 0,
      currency: 'USD',
    };
  }

  try {
    const [partnerRes, commRes] = await Promise.all([
      d1.prepare(
        `SELECT COUNT(*) AS total_partners,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_partners
         FROM affiliate_partners`
      ).first<RawPartnerStatsRow>(),
      d1.prepare(
        `SELECT SUM(commission_cents) AS total_comm,
                SUM(CASE WHEN status IN ('pending', 'payable') THEN commission_cents ELSE 0 END) AS pending_comm,
                SUM(CASE WHEN status = 'settled' THEN commission_cents ELSE 0 END) AS settled_comm
         FROM affiliate_commissions`
      ).first<RawCommissionStatsRow>(),
    ]);

    return {
      totalAffiliates: partnerRes?.total_partners ?? 0,
      activeAffiliates: partnerRes?.active_partners ?? 0,
      totalCommissionCents: commRes?.total_comm ?? 0,
      pendingCommissionCents: commRes?.pending_comm ?? 0,
      settledCommissionCents: commRes?.settled_comm ?? 0,
      currency: 'USD',
    };
  } catch (err) {
    logger.warn('[AffiliateLedgerService] Failed to fetch ledger stats', { error: String(err) });
    return {
      totalAffiliates: 0,
      activeAffiliates: 0,
      totalCommissionCents: 0,
      pendingCommissionCents: 0,
      settledCommissionCents: 0,
      currency: 'USD',
    };
  }
}
