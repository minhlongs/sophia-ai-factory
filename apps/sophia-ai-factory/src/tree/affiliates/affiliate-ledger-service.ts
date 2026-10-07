/**
 * Affiliate Ledger Service
 *
 * Provides D1 queries for affiliate statistics aggregation,
 * Optimistic Concurrency Control (OCC) for payout disbursement and
 * commission status transitions, and dual-rail settlement (USDT & VietQR).
 *
 * Layer: tree (domain business logic, edge-compatible, zero forest/land imports).
 *
 * @module tree/affiliates/affiliate-ledger-service
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AffiliateLedgerStats,
  AffiliateOffer,
  AffiliateOfferCategory,
  AffiliateOfferRow,
  AffiliatePayoutModel,
  AffiliatePartner,
  AffiliatePartnerRow,
  AffiliatePayoutRow,
  CommissionStatus,
  PayoutRail,
} from '@/seed/types/affiliate';
import affiliateData from '@/seed/data/affiliate-programs.json';

interface RawPartnerStatsRow {
  total_partners: number;
  active_partners: number;
}

interface RawCommissionStatsRow {
  total_comm: number | null;
  pending_comm: number | null;
  settled_comm: number | null;
}

interface RawPartnerActivityRow {
  total_referrals: number;
  converted_referrals: number;
  total_earnings_cents: number;
  pending_payout_cents: number;
  settled_payout_cents: number;
}

/**
 * Resolves the active Cloudflare D1 database.
 */
export async function resolveD1(customD1?: D1Database): Promise<D1Database | null> {
  if (customD1) return customD1;
  try {
    return await getD1Raw();
  } catch (err) {
    logger.warn('[AffiliateLedgerService] Failed to resolve D1 database', { error: String(err) });
    return null;
  }
}

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
): Promise<{
  partnerId: string;
  totalEarningsCents: number;
  pendingPayoutCents: number;
  settledPayoutCents: number;
  totalReferrals: number;
  convertedReferrals: number;
  conversionRatePct: number;
} | null> {
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

/**
 * Initiates a new payout disbursement with Optimistic Concurrency Control (OCC) version 1.
 * Supports dual-rail disbursements: 'USDT' (TRC-20) and 'VIETQR' (NAPAS 247).
 */
export async function createPayoutDisbursement(input: {
  partnerId: string;
  rail: PayoutRail;
  amountCents: number;
  currency?: string;
  destinationEncrypted: string;
  d1?: D1Database;
}): Promise<{
  success: boolean;
  payoutId?: string;
  payoutReference?: string;
  error?: string;
}> {
  const d1 = await resolveD1(input.d1);
  if (!d1) return { success: false, error: 'DATABASE_UNAVAILABLE' };

  if (input.amountCents <= 0) {
    return { success: false, error: 'INVALID_AMOUNT' };
  }

  try {
    const partner = await d1
      .prepare(`SELECT * FROM affiliate_partners WHERE id = ?1 LIMIT 1`)
      .bind(input.partnerId)
      .first<AffiliatePartnerRow>();

    if (!partner) return { success: false, error: 'PARTNER_NOT_FOUND' };
    if (partner.status !== 'active') return { success: false, error: 'PARTNER_INACTIVE' };
    if (partner.pending_payout_cents < input.amountCents) {
      return { success: false, error: 'INSUFFICIENT_PENDING_BALANCE' };
    }

    const payoutId = `po_${crypto.randomUUID().replace(/-/g, '')}`;
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = crypto.randomUUID().slice(0, 6).toUpperCase();
    const payoutReference = `PO_${datePart}_${randPart}`;
    const nowMs = Date.now();
    const currency = input.currency ?? (input.rail === 'VIETQR' ? 'VND' : 'USD');

    await d1
      .prepare(
        `INSERT INTO affiliate_payouts (
           id, payout_reference, partner_id, rail, amount_cents, currency,
           destination_encrypted, status, commission_count, version, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, 1, ?, ?)`
      )
      .bind(
        payoutId,
        payoutReference,
        input.partnerId,
        input.rail,
        input.amountCents,
        currency,
        input.destinationEncrypted,
        nowMs,
        nowMs
      )
      .run();

    return {
      success: true,
      payoutId,
      payoutReference,
    };
  } catch (err) {
    logger.error('[AffiliateLedgerService] Failed to create payout disbursement', {
      partnerId: input.partnerId,
      error: String(err),
    });
    return { success: false, error: String(err) };
  }
}

/**
 * Approves a payout disbursement using Optimistic Concurrency Control (OCC).
 * Atomically updates version = version + 1 WHERE id = ? AND version = ?.
 */
export async function approvePayoutDisbursement(input: {
  payoutId: string;
  currentVersion: number;
  approvedBy: string;
  d1?: D1Database;
}): Promise<{
  success: boolean;
  newVersion?: number;
  conflict?: boolean;
  error?: string;
}> {
  const d1 = await resolveD1(input.d1);
  if (!d1) return { success: false, error: 'DATABASE_UNAVAILABLE' };

  try {
    const nowMs = Date.now();
    const updateRes = await d1
      .prepare(
        `UPDATE affiliate_payouts
         SET status = 'approved',
             approved_by = ?1,
             approved_at = ?2,
             version = version + 1,
             updated_at = ?2
         WHERE id = ?3 AND version = ?4 AND status IN ('draft', 'pending_approval')`
      )
      .bind(input.approvedBy, nowMs, input.payoutId, input.currentVersion)
      .run();

    const changes = updateRes.meta?.changes ?? 0;
    if (changes === 0) {
      logger.warn('[AffiliateLedgerService] OCC conflict during payout approval', {
        payoutId: input.payoutId,
        currentVersion: input.currentVersion,
      });
      return {
        success: false,
        conflict: true,
        error: 'OCC_VERSION_CONFLICT',
      };
    }

    return {
      success: true,
      newVersion: input.currentVersion + 1,
    };
  } catch (err) {
    logger.error('[AffiliateLedgerService] Error approving payout', {
      payoutId: input.payoutId,
      error: String(err),
    });
    return { success: false, error: String(err) };
  }
}

/**
 * Completes a payout disbursement upon proof of transaction execution (USDT txHash or VietQR bank ref).
 * Atomically increments version and updates partner balances.
 */
export async function completePayoutDisbursement(input: {
  payoutId: string;
  currentVersion: number;
  txHashOrBankRef: string;
  d1?: D1Database;
}): Promise<{
  success: boolean;
  newVersion?: number;
  conflict?: boolean;
  error?: string;
}> {
  const d1 = await resolveD1(input.d1);
  if (!d1) return { success: false, error: 'DATABASE_UNAVAILABLE' };

  try {
    const payout = await d1
      .prepare(`SELECT * FROM affiliate_payouts WHERE id = ?1 LIMIT 1`)
      .bind(input.payoutId)
      .first<AffiliatePayoutRow>();

    if (!payout) return { success: false, error: 'PAYOUT_NOT_FOUND' };

    const nowMs = Date.now();
    const updateRes = await d1
      .prepare(
        `UPDATE affiliate_payouts
         SET status = 'completed',
             tx_hash_or_bank_ref = ?1,
             version = version + 1,
             updated_at = ?2
         WHERE id = ?3 AND version = ?4 AND status = 'approved'`
      )
      .bind(input.txHashOrBankRef, nowMs, input.payoutId, input.currentVersion)
      .run();

    const changes = updateRes.meta?.changes ?? 0;
    if (changes === 0) {
      logger.warn('[AffiliateLedgerService] OCC conflict completing payout', {
        payoutId: input.payoutId,
        currentVersion: input.currentVersion,
      });
      return {
        success: false,
        conflict: true,
        error: 'OCC_VERSION_CONFLICT',
      };
    }

    // Atomically transition commissions and partner pending balance
    await d1.batch([
      d1
        .prepare(
          `UPDATE affiliate_commissions
           SET status = 'settled',
               settled_at = ?1,
               version = version + 1,
               updated_at = ?1
           WHERE payout_id = ?2 AND status = 'payable'`
        )
        .bind(nowMs, input.payoutId),
      d1
        .prepare(
          `UPDATE affiliate_partners
           SET pending_payout_cents = MAX(0, pending_payout_cents - ?1),
               settled_payout_cents = COALESCE(settled_payout_cents, 0) + ?1,
               updated_at = ?2
           WHERE id = ?3`
        )
        .bind(payout.amount_cents, nowMs, payout.partner_id),
    ]);

    return {
      success: true,
      newVersion: input.currentVersion + 1,
    };
  } catch (err) {
    logger.error('[AffiliateLedgerService] Error completing payout', {
      payoutId: input.payoutId,
      error: String(err),
    });
    return { success: false, error: String(err) };
  }
}

/**
 * Updates a commission status with Optimistic Concurrency Control (OCC).
 */
export async function updateCommissionStatusWithOcc(input: {
  commissionId: string;
  currentVersion: number;
  targetStatus: CommissionStatus;
  payoutId?: string | null;
  d1?: D1Database;
}): Promise<{
  success: boolean;
  newVersion?: number;
  conflict?: boolean;
  error?: string;
}> {
  const d1 = await resolveD1(input.d1);
  if (!d1) return { success: false, error: 'DATABASE_UNAVAILABLE' };

  try {
    const nowMs = Date.now();
    const updateRes = await d1
      .prepare(
        `UPDATE affiliate_commissions
         SET status = ?1,
             payout_id = CASE WHEN ?2 IS NOT NULL THEN ?2 ELSE payout_id END,
             version = version + 1,
             updated_at = ?3
         WHERE id = ?4 AND version = ?5`
      )
      .bind(
        input.targetStatus,
        input.payoutId ?? null,
        nowMs,
        input.commissionId,
        input.currentVersion
      )
      .run();

    const changes = updateRes.meta?.changes ?? 0;
    if (changes === 0) {
      return {
        success: false,
        conflict: true,
        error: 'OCC_VERSION_CONFLICT',
      };
    }

    return {
      success: true,
      newVersion: input.currentVersion + 1,
    };
  } catch (err) {
    logger.error('[AffiliateLedgerService] Error updating commission with OCC', {
      commissionId: input.commissionId,
      error: String(err),
    });
    return { success: false, error: String(err) };
  }
}

/**
 * Queries active affiliate offers supporting live search, category, and payout model filters.
 * Returns authentic programs directly from D1 or authentic JSON seed fallback.
 */
export async function getAffiliateOffers(
  options: {
    category?: string;
    payoutModel?: string;
    search?: string;
    sortBy?: 'epc' | 'conversion' | 'commission' | 'quality';
    limit?: number;
    offset?: number;
  } = {},
  customD1?: D1Database
): Promise<{ offers: AffiliateOffer[]; total: number }> {
  const d1 = await resolveD1(customD1);
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  if (d1) {
    try {
      let query = `SELECT * FROM affiliate_offers WHERE status = 'active'`;
      const binds: unknown[] = [];

      if (options.category && options.category !== 'all') {
        query += ` AND LOWER(category) = LOWER(?)`;
        binds.push(options.category);
      }

      if (options.payoutModel && options.payoutModel !== 'all') {
        query += ` AND LOWER(payout_model) = LOWER(?)`;
        binds.push(options.payoutModel);
      }

      if (options.search && options.search.trim()) {
        query += ` AND (LOWER(program_name) LIKE ? OR LOWER(commission_terms) LIKE ?)`;
        const wildcard = `%${options.search.trim().toLowerCase()}%`;
        binds.push(wildcard, wildcard);
      }

      // Sorting
      switch (options.sortBy) {
        case 'conversion':
          query += ` ORDER BY conversion_rate_pct DESC`;
          break;
        case 'commission':
          query += ` ORDER BY commission_rate_pct DESC`;
          break;
        case 'quality':
          query += ` ORDER BY quality_score DESC`;
          break;
        case 'epc':
        default:
          query += ` ORDER BY epc DESC`;
          break;
      }

      query += ` LIMIT ? OFFSET ?`;
      binds.push(limit, offset);

      const rows = await d1
        .prepare(query)
        .bind(...binds)
        .all<AffiliateOfferRow>();

      if (rows.results && rows.results.length > 0) {
        const offers: AffiliateOffer[] = rows.results.map((row) => ({
          id: row.id,
          programName: row.program_name || row.title || 'Partner Program',
          category: (row.category as AffiliateOfferCategory) || 'SaaS',
          payoutModel: (row.payout_model as AffiliatePayoutModel) || 'RevShare',
          commissionRatePct: row.commission_rate_pct ?? 20.0,
          commissionTerms: row.commission_terms || `${row.commission_rate_pct ?? 20}% commission`,
          epc: row.epc ?? 0.0,
          conversionRatePct: row.conversion_rate_pct ?? 0.0,
          qualityScore: row.quality_score ?? 9.0,
          destinationUrl: row.destination_url || row.product_url || 'https://sophia.agencyos.network',
          logoUrl: row.logo_url || row.image_url || undefined,
          cookieWindowDays: row.cookie_window_days ?? 30,
          minPayoutUsd: row.min_payout_usd ?? 50.0,
          status: row.status,
        }));

        return { offers, total: offers.length };
      }
    } catch (err) {
      logger.warn('[AffiliateLedgerService] Failed querying affiliate_offers from D1, using authentic fallback', {
        error: String(err),
      });
    }
  }

  // Authentic Seed Fallback (from affiliate-programs.json, zero broken/synthetic URLs)
  const rawPrograms = (affiliateData.programs || []) as Array<{
    id: string;
    name: string;
    category: string;
    commission: string;
    commissionType: string;
    cookieDuration: number;
    epc: number;
    link: string;
    description: string;
  }>;

  let filtered = rawPrograms.map((p) => {
    const rateNum = parseFloat(p.commission.replace(/[^0-9.]/g, '')) || 20.0;
    const model: AffiliatePayoutModel =
      p.commissionType === 'one-time'
        ? 'Flat CPA'
        : p.commissionType === 'recurring'
          ? 'Recurring'
          : 'RevShare %';

    const cat: AffiliateOfferCategory =
      p.category === 'E-commerce'
        ? 'E-Commerce'
        : p.category === 'Design' || p.category === 'Video' || p.category === 'Education'
          ? 'Creator Tools'
          : p.category === 'Sales' || p.category === 'Lead Gen' || p.category === 'Automation'
            ? 'Agency Automation'
            : 'SaaS';

    return {
      id: p.id,
      programName: p.name,
      category: cat,
      payoutModel: model,
      commissionRatePct: rateNum,
      commissionTerms: `${p.commission} (${p.commissionType})`,
      epc: p.epc || 10.0,
      conversionRatePct: 4.5,
      qualityScore: 9.2,
      destinationUrl: p.link,
      cookieWindowDays: p.cookieDuration || 30,
      minPayoutUsd: 50.0,
      status: 'active',
    } satisfies AffiliateOffer;
  });

  if (options.category && options.category !== 'all') {
    filtered = filtered.filter(
      (p) => p.category.toLowerCase() === options.category!.toLowerCase()
    );
  }

  if (options.payoutModel && options.payoutModel !== 'all') {
    filtered = filtered.filter(
      (p) => p.payoutModel.toLowerCase() === options.payoutModel!.toLowerCase()
    );
  }

  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    filtered = filtered.filter(
      (p) => p.programName.toLowerCase().includes(q) || p.commissionTerms.toLowerCase().includes(q)
    );
  }

  switch (options.sortBy) {
    case 'conversion':
      filtered.sort((a, b) => b.conversionRatePct - a.conversionRatePct);
      break;
    case 'commission':
      filtered.sort((a, b) => b.commissionRatePct - a.commissionRatePct);
      break;
    case 'quality':
      filtered.sort((a, b) => b.qualityScore - a.qualityScore);
      break;
    case 'epc':
    default:
      filtered.sort((a, b) => b.epc - a.epc);
      break;
  }

  const paginated = filtered.slice(offset, offset + limit);
  return { offers: paginated, total: filtered.length };
}
