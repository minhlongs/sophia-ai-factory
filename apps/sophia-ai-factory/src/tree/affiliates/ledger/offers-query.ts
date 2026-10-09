/**
 * Affiliate Ledger Submodule: Offers Query & Authentic Catalog.
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/offers-query
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type { AffiliateOffer, AffiliateOfferRow } from '@/seed/types/affiliate';
import affiliateData from '@/seed/data/affiliate-programs.json';
import { resolveD1 } from './db-resolver';
import type { AffiliateOffersQueryOptions } from './types';
import { mapRawProgramToOffer, mapRowToOffer } from './offer-mappers';

type RawProgramSeed = Parameters<typeof mapRawProgramToOffer>[0];

/**
 * Queries active affiliate offers supporting live search, category, and payout model filters.
 * Returns authentic programs directly from D1 or authentic JSON seed fallback.
 */
export async function getAffiliateOffers(
  options: AffiliateOffersQueryOptions = {},
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

      const rows = await d1.prepare(query).bind(...binds).all<AffiliateOfferRow>();

      if (rows.results && rows.results.length > 0) {
        const offers = rows.results.map(mapRowToOffer);
        return { offers, total: offers.length };
      }
    } catch (err) {
      logger.warn('[AffiliateLedgerService] Failed querying affiliate_offers from D1, using authentic fallback', {
        error: String(err),
      });
    }
  }

  // Authentic Seed Fallback
  const rawPrograms = (affiliateData.programs || []) as RawProgramSeed[];
  let filtered = rawPrograms.map(mapRawProgramToOffer);

  if (options.category && options.category !== 'all') {
    filtered = filtered.filter((p) => p.category.toLowerCase() === options.category!.toLowerCase());
  }

  if (options.payoutModel && options.payoutModel !== 'all') {
    filtered = filtered.filter((p) => p.payoutModel.toLowerCase() === options.payoutModel!.toLowerCase());
  }

  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    filtered = filtered.filter((p) => p.programName.toLowerCase().includes(q) || p.commissionTerms.toLowerCase().includes(q));
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
