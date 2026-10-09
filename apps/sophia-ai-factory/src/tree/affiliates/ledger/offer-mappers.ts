/**
 * Affiliate Ledger Submodule: Offer Data Mappers.
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/offer-mappers
 */

import type {
  AffiliateOffer,
  AffiliateOfferCategory,
  AffiliateOfferRow,
  AffiliatePayoutModel,
} from '@/seed/types/affiliate';

/**
 * Maps raw JSON seed program to AffiliateOffer.
 */
export function mapRawProgramToOffer(p: {
  id: string;
  name: string;
  category: string;
  commission: string;
  commissionType: string;
  cookieDuration: number;
  epc: number;
  link: string;
  description: string;
}): AffiliateOffer {
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
  };
}

/**
 * Maps database AffiliateOfferRow to AffiliateOffer domain model.
 */
export function mapRowToOffer(row: AffiliateOfferRow): AffiliateOffer {
  return {
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
  };
}
