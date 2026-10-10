import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { encryptSecret } from '@/tree/crypto/encrypt-secret';
import { validateTrc20Address } from '@/land/payouts/usdt-addr-validator';
import type {
  AffiliatePartner,
  AffiliatePartnerRow,
  AffiliateStats,
} from '@/seed/types/affiliate';
import type {
  RecordClickInput,
} from './types';
import { rowToPartner } from './partner-registration';

/**
 * Retrieve partner profile by user ID.
 */
export async function getPartnerByUserId(userId: string): Promise<AffiliatePartner | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const row = await db
    .prepare('SELECT * FROM affiliate_partners WHERE user_id = ?')
    .bind(userId)
    .first<AffiliatePartnerRow>();

  return row ? rowToPartner(row) : null;
}

/**
 * Retrieve partner profile by partner referral code.
 */
export async function getPartnerByCode(code: string): Promise<AffiliatePartner | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const row = await db
    .prepare('SELECT * FROM affiliate_partners WHERE partner_code = ?')
    .bind(code.toUpperCase().trim())
    .first<AffiliatePartnerRow>();

  return row ? rowToPartner(row) : null;
}

/**
 * Record a referral click event for attribution.
 */
export async function recordPartnerClick(input: RecordClickInput): Promise<boolean> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const partner = await getPartnerByCode(input.partnerCode);
  if (!partner) {
    logger.warn('[AffiliatePartnerService] Click rejected: unknown partner code', {
      code: input.partnerCode,
    });
    return false;
  }

  const clickId = `clk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Date.now();

  try {
    await db
      .prepare(
        `INSERT INTO affiliate_referral_clicks (
          id, affiliate_partner_id, partner_code, ip_hash, user_agent, referer_url, sub_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        clickId,
        partner.id,
        partner.partnerCode,
        input.ipHash ?? null,
        input.userAgent ? input.userAgent.slice(0, 120) : null,
        input.refererUrl ?? null,
        input.subId ?? null,
        now
      )
      .run();

    return true;
  } catch (err) {
    logger.error('[AffiliatePartnerService] Failed to record click', err instanceof Error ? err : undefined, {
      partnerCode: input.partnerCode,
    });
    return false;
  }
}

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
       WHERE affiliate_id = ?`
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

/**
 * Update encrypted payout address.
 */
export async function updatePartnerPayoutAddress(
  partnerId: string,
  usdtTrc20Address: string
): Promise<boolean> {
  const isValid = await validateTrc20Address(usdtTrc20Address);
  if (!isValid) {
    throw new Error(`Invalid TRC-20 USDT wallet address: ${usdtTrc20Address}`);
  }

  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const encrypted = await encryptSecret(usdtTrc20Address);
  const now = Date.now();

  const res = await db
    .prepare(
      `UPDATE affiliate_partners
       SET usdt_trc20_address_encrypted = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(encrypted, now, partnerId)
    .run();

  return (res.meta?.changes ?? 0) > 0;
}
