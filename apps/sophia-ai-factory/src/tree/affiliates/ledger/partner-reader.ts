/**
 * Affiliate Ledger Submodule: Partner Reader & Partner Ledger Stats.
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/partner-reader
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AffiliatePartner,
  AffiliatePartnerRow,
} from '@/seed/types/affiliate';
import { resolveD1 } from './db-resolver';
import type { RawPartnerActivityRow, PartnerLedgerStatsResult } from './types';

/**
 * Fetches an affiliate partner by ID, user ID, or partner code.
 */
export async function getPartnerSummary(
  identifier: string,
  customD1?: D1Database
): Promise<AffiliatePartner | null> {
  const d1 = await resolveD1(customD1);
  if (!d1 || !identifier) return null;

  try {
    const row = await d1
      .prepare(
        `SELECT * FROM affiliate_partners
         WHERE id = ?1 OR user_id = ?1 OR partner_code = ?1
         LIMIT 1`
      )
      .bind(identifier)
      .first<AffiliatePartnerRow>();

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      partnerCode: row.partner_code,
      tier: row.tier,
      commissionRatePct: row.commission_rate_pct,
      tier2RatePct: row.tier2_rate_pct,
      parentPartnerId: row.parent_partner_id,
      usdtTrc20AddressEncrypted: row.usdt_trc20_address_encrypted,
      status: row.status,
      totalEarningsCents: row.total_earnings_cents,
      pendingPayoutCents: row.pending_payout_cents,
      settledPayoutCents: row.settled_payout_cents ?? 0,
      customRateOverridePct: row.custom_rate_override_pct,
      payoutRail: row.payout_rail,
      bankBin: row.bank_bin,
      bankAccountNumber: row.bank_account_number,
      bankAccountName: row.bank_account_name,
      activatedMrrCents: row.activated_mrr_cents,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  } catch (err) {
    logger.warn('[AffiliateLedgerService] Error fetching partner summary', {
      identifier,
      error: String(err),
    });
    return null;
  }
}

/**
 * Aggregates referral activity and commission summary for a specific partner.
 */
export async function getPartnerLedgerStats(
  partnerId: string,
  customD1?: D1Database
): Promise<PartnerLedgerStatsResult | null> {
  const d1 = await resolveD1(customD1);
  if (!d1) return null;

  try {
    const [partner, referralRes] = await Promise.all([
      d1
        .prepare(`SELECT * FROM affiliate_partners WHERE id = ?1 LIMIT 1`)
        .bind(partnerId)
        .first<AffiliatePartnerRow>(),
      d1
        .prepare(
          `SELECT COUNT(*) AS total_referrals,
                  SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted_referrals
           FROM affiliate_referrals WHERE partner_id = ?1`
        )
        .bind(partnerId)
        .first<RawPartnerActivityRow>(),
    ]);

    if (!partner) return null;

    const totalReferrals = referralRes?.total_referrals ?? 0;
    const convertedReferrals = referralRes?.converted_referrals ?? 0;
    const conversionRatePct =
      totalReferrals > 0 ? Math.round((convertedReferrals / totalReferrals) * 1000) / 10 : 0;

    return {
      partnerId: partner.id,
      totalEarningsCents: partner.total_earnings_cents,
      pendingPayoutCents: partner.pending_payout_cents,
      settledPayoutCents: partner.settled_payout_cents ?? 0,
      totalReferrals,
      convertedReferrals,
      conversionRatePct,
    };
  } catch (err) {
    logger.warn('[AffiliateLedgerService] Failed to calculate partner activity stats', {
      partnerId,
      error: String(err),
    });
    return null;
  }
}
