import { getD1 } from '@/seed/db/client';
import type {
  AffiliatePartnerRow,
  AffiliateStats,
} from '@/seed/types/affiliate';
import { rowToPartner } from './partner-registration';

/**
 * Retrieve complete affiliate performance statistics.
 */
export async function getPartnerStats(partnerCodeOrUserId: string): Promise<AffiliateStats | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const partnerRow = await db
    .prepare('SELECT * FROM affiliate_partners WHERE partner_code = ? OR user_id = ?')
    .bind(partnerCodeOrUserId, partnerCodeOrUserId)
    .first<AffiliatePartnerRow>();

  if (!partnerRow) return null;

  const partner = rowToPartner(partnerRow);

  const clicksRes = await db
    .prepare('SELECT COUNT(*) as count FROM affiliate_referral_clicks WHERE affiliate_partner_id = ?')
    .bind(partner.id)
    .first<{ count: number }>();
  const totalClicks = clicksRes?.count ?? 0;

  const ledgerRes = await db
    .prepare(
      `SELECT
        COUNT(CASE WHEN status IN ('pending', 'payable', 'paying', 'paid') THEN 1 END) as total_conversions,
        COALESCE(SUM(CASE WHEN status IN ('pending', 'payable', 'paying', 'paid') THEN commission_cents ELSE 0 END), 0) as total_earnings_cents,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_cents ELSE 0 END), 0) as pending_payout_cents,
        COALESCE(SUM(CASE WHEN status = 'payable' THEN commission_cents - withheld_cents ELSE 0 END), 0) as available_payout_cents,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_cents - withheld_cents ELSE 0 END), 0) as lifetime_paid_cents
       FROM commission_ledger
       WHERE affiliate_id = ?`,
    )
    .bind(partner.id)
    .first<{
      total_conversions: number;
      total_earnings_cents: number;
      pending_payout_cents: number;
      available_payout_cents: number;
      lifetime_paid_cents: number;
    }>();

  const totalConversions = ledgerRes?.total_conversions ?? 0;
  const conversionRatePct = totalClicks > 0 ? Number(((totalConversions / totalClicks) * 100).toFixed(2)) : 0;

  return {
    partnerCode: partner.partnerCode,
    tier: partner.tier,
    commissionRatePct: partner.commissionRatePct,
    tier2RatePct: partner.tier2RatePct,
    totalClicks,
    totalConversions,
    conversionRatePct,
    totalEarningsCents: ledgerRes?.total_earnings_cents ?? partner.totalEarningsCents,
    pendingPayoutCents: ledgerRes?.pending_payout_cents ?? partner.pendingPayoutCents,
    availablePayoutCents: ledgerRes?.available_payout_cents ?? 0,
    lifetimePaidCents: ledgerRes?.lifetime_paid_cents ?? 0,
  };
}
