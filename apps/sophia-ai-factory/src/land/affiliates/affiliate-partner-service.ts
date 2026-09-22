/**
 * Sophia AI Factory Affiliate Partner Service
 *
 * Implements Partner Program management, partner code generation, personalized share links,
 * multi-tier recurring MRR commission calculation (20%-30% direct + 5% Tier 2 override),
 * click tracking, and performance statistics query.
 *
 * @module land/affiliates/affiliate-partner-service
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { encryptSecret } from '@/tree/crypto/encrypt-secret';
import { validateTrc20Address } from '@/land/payouts/usdt-addr-validator';
import type {
  AffiliatePartner,
  AffiliatePartnerRow,
  PartnerTier,
  PartnerStatus,
  AffiliateStats,
} from '@/seed/types/affiliate';

export interface RegisterPartnerInput {
  userId: string;
  requestedCode?: string;
  parentPartnerId?: string;
  usdtTrc20Address?: string;
  tier?: PartnerTier;
}

export interface CalculateCommissionInput {
  orderAmountCents: number;
  activeSalesCount: number;
  isTier2?: boolean;
  partnerTier?: PartnerTier;
  customRatePct?: number;
}

export interface CommissionCalculationResult {
  ratePct: number;
  commissionCents: number;
  tier: PartnerTier | 'TIER2';
  isTier2: boolean;
}

export interface ShareLinkOptions {
  subId?: string;
  baseUrl?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
}

export interface RecordClickInput {
  partnerCode: string;
  ipHash?: string;
  userAgent?: string;
  refererUrl?: string;
  subId?: string;
}

/**
 * Generate a clean, unique partner referral code.
 */
export function generatePartnerCode(seed?: string): string {
  if (seed && seed.trim().length > 0) {
    const clean = seed
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12);
    if (clean.length >= 3) {
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `${clean}${suffix}`;
    }
  }
  const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SOPHIA_${randomChars}`;
}

/**
 * Generate a personalized share link with tracking parameters.
 */
export function generateShareLink(code: string, options: ShareLinkOptions = {}): string {
  const base = (options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network').replace(/\/$/, '');
  const url = new URL(base);
  url.searchParams.set('ref', code);

  if (options.subId) {
    url.searchParams.set('sub_id', options.subId);
  }
  if (options.utmSource) {
    url.searchParams.set('utm_source', options.utmSource);
  }
  if (options.utmCampaign) {
    url.searchParams.set('utm_campaign', options.utmCampaign);
  }
  if (options.utmMedium) {
    url.searchParams.set('utm_medium', options.utmMedium);
  }

  return url.toString();
}

/**
 * Calculate multi-tier recurring MRR commission.
 * - Tier 1: 20% base rate (STANDARD), 30% for high volume (>5 sales, VIP/SUPER).
 * - Tier 2: 5% override.
 */
export function calculatePartnerCommission(input: CalculateCommissionInput): CommissionCalculationResult {
  const { orderAmountCents, activeSalesCount, isTier2 = false, customRatePct } = input;

  if (orderAmountCents <= 0) {
    return {
      ratePct: 0,
      commissionCents: 0,
      tier: isTier2 ? 'TIER2' : 'STANDARD',
      isTier2,
    };
  }

  if (isTier2) {
    const ratePct = 5.0;
    const commissionCents = Math.round(orderAmountCents * (ratePct / 100));
    return {
      ratePct,
      commissionCents,
      tier: 'TIER2',
      isTier2: true,
    };
  }

  // Tier 1 calculation: 20% default, 30% for high volume (>5 sales)
  let tier: PartnerTier = 'STANDARD';
  let defaultRatePct = 20.0;

  if (activeSalesCount > 5) {
    tier = activeSalesCount > 20 ? 'SUPER' : 'VIP';
    defaultRatePct = 30.0;
  }

  const ratePct = customRatePct !== undefined && customRatePct > defaultRatePct ? customRatePct : defaultRatePct;
  const commissionCents = Math.round(orderAmountCents * (ratePct / 100));

  return {
    ratePct,
    commissionCents,
    tier,
    isTier2: false,
  };
}

/**
 * Convert DB row to domain model.
 */
function rowToPartner(row: AffiliatePartnerRow): AffiliatePartner {
  return {
    id: row.id,
    userId: row.user_id,
    partnerCode: row.partner_code,
    tier: row.tier,
    commissionRatePct: Number(row.commission_rate_pct),
    tier2RatePct: Number(row.tier2_rate_pct),
    parentPartnerId: row.parent_partner_id,
    usdtTrc20AddressEncrypted: row.usdt_trc20_address_encrypted,
    status: row.status,
    totalEarningsCents: Number(row.total_earnings_cents),
    pendingPayoutCents: Number(row.pending_payout_cents),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Register a new affiliate partner profile.
 */
export async function registerPartner(input: RegisterPartnerInput): Promise<AffiliatePartner> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  // Check if partner profile already exists for user
  const existing = await db
    .prepare('SELECT * FROM affiliate_partners WHERE user_id = ?')
    .bind(input.userId)
    .first<AffiliatePartnerRow>();

  if (existing) {
    return rowToPartner(existing);
  }

  // Validate or generate partner code
  let code = input.requestedCode?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{3,30}$/.test(code)) {
    code = generatePartnerCode();
  }

  // Ensure code uniqueness
  const duplicate = await db
    .prepare('SELECT id FROM affiliate_partners WHERE partner_code = ?')
    .bind(code)
    .first<{ id: string }>();

  if (duplicate) {
    code = generatePartnerCode(code);
  }

  let encryptedAddress: string | null = null;
  if (input.usdtTrc20Address) {
    const isValid = await validateTrc20Address(input.usdtTrc20Address);
    if (!isValid) {
      throw new Error(`Invalid TRC-20 USDT wallet address: ${input.usdtTrc20Address}`);
    }
    encryptedAddress = await encryptSecret(input.usdtTrc20Address);
  }

  const id = `aff_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Date.now();
  const tier: PartnerTier = input.tier || 'STANDARD';
  const commissionRatePct = 20.0;
  const tier2RatePct = 5.0;
  const status: PartnerStatus = 'active';

  await db
    .prepare(
      `INSERT INTO affiliate_partners (
        id, user_id, partner_code, tier, commission_rate_pct, tier2_rate_pct,
        parent_partner_id, usdt_trc20_address_encrypted, status,
        total_earnings_cents, pending_payout_cents, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
    )
    .bind(
      id,
      input.userId,
      code,
      tier,
      commissionRatePct,
      tier2RatePct,
      input.parentPartnerId ?? null,
      encryptedAddress,
      status,
      now,
      now
    )
    .run();

  logger.info('[AffiliatePartnerService] Partner registered', {
    partnerId: id,
    userId: input.userId,
    partnerCode: code,
  });

  return {
    id,
    userId: input.userId,
    partnerCode: code,
    tier,
    commissionRatePct,
    tier2RatePct,
    parentPartnerId: input.parentPartnerId,
    usdtTrc20AddressEncrypted: encryptedAddress,
    status,
    totalEarningsCents: 0,
    pendingPayoutCents: 0,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}

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

  // Click count
  const clicksRes = await db
    .prepare('SELECT COUNT(*) as count FROM affiliate_referral_clicks WHERE affiliate_partner_id = ?')
    .bind(partner.id)
    .first<{ count: number }>();
  const totalClicks = clicksRes?.count ?? 0;

  // Conversions and financial ledger aggregation
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
