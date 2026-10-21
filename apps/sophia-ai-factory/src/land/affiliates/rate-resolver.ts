/**
 * Affiliate Commission Rate Resolver
 *
 * Pure resolution of commission rate and recurring duration from the
 * *referred customer's* subscription tier. The rate follows the customer,
 * not the partner: a partner referring an ENTERPRISE customer earns
 * marginally less than the same partner referring a BASIC customer,
 * because enterprise accounts have higher gross value but lower margin.
 *
 * MASTER referrals are compensated once (recurringMonths = 0) since MASTER
 * is a lifetime tier with no recurring subscription to share.
 *
 * @module affiliates/rate-resolver
 */

import type { Tier } from '@/seed/types';
import type { AffiliatePartnerRow } from '@/seed/types/affiliate';
import {
  AFFILIATE_RATE_BY_TIER,
  AFFILIATE_RECURRING_MONTHS,
  FALLBACK_COMMISSION_RATE_PCT,
} from '@/seed/config/revenue-share';

/** Resolved commission terms for a single attribution event. */
export interface ResolvedCommissionRate {
  /** Commission percentage expressed 0-100 (e.g. 30 = 30%). */
  ratePct: number;
  /** Number of recurring months earned. 0 means a one-time commission. */
  recurringMonths: number;
  /** Customer tier that selected the rate. */
  customerTier: Tier;
}

/**
 * Picks the commission rate for a referred customer's tier.
 *
 * The tier table is exhaustive over the Tier enum, so the lookup always
 * resolves; an unrecognized tier string degrades to the DEFAULT bucket
 * rather than throwing.
 */
export function resolveTierRate(customerTier: Tier): ResolvedCommissionRate {
  const table: Record<Tier, ResolvedCommissionRate> = {
    BASIC: { ratePct: AFFILIATE_RATE_BY_TIER.BASIC, recurringMonths: AFFILIATE_RECURRING_MONTHS, customerTier: 'BASIC' },
    PREMIUM: { ratePct: AFFILIATE_RATE_BY_TIER.PREMIUM, recurringMonths: AFFILIATE_RECURRING_MONTHS, customerTier: 'PREMIUM' },
    ENTERPRISE: { ratePct: AFFILIATE_RATE_BY_TIER.ENTERPRISE, recurringMonths: AFFILIATE_RECURRING_MONTHS, customerTier: 'ENTERPRISE' },
    MASTER: { ratePct: AFFILIATE_RATE_BY_TIER.MASTER, recurringMonths: 0, customerTier: 'MASTER' },
  };

  return table[customerTier] ?? table.BASIC;
}

/**
 * Resolves the commission rate for an attribution.
 *
 * Precedence, highest to lowest:
 *   1. `custom_rate_override_pct` on the partner — an operator-set manual
 *      override that always wins. It preserves the partner's default
 *      recurring window because an override does not change the customer's
 *      subscription cadence.
 *   2. The referred customer's tier rate (30/25/20/10% × 12 months,
 *      MASTER one-time).
 *   3. The partner's own `commission_rate_pct` default, used only when the
 *      customer tier could not be determined at all.
 *
 * @param customerTier Resolved tier of the referred customer, or null when
 *   the tier lookup failed and the caller wants the legacy partner default.
 * @param partner The referring partner row.
 */
export function resolveCommissionRate(
  customerTier: Tier | null | undefined,
  partner: Pick<AffiliatePartnerRow, 'commission_rate_pct' | 'custom_rate_override_pct'>,
): ResolvedCommissionRate {
  const overridePct = partner.custom_rate_override_pct;
  if (typeof overridePct === 'number' && overridePct > 0) {
    return {
      ratePct: overridePct,
      recurringMonths: AFFILIATE_RECURRING_MONTHS,
      customerTier: customerTier ?? 'BASIC',
    };
  }

  if (customerTier) {
    return resolveTierRate(customerTier);
  }

  const partnerDefault = partner.commission_rate_pct;
  return {
    ratePct: typeof partnerDefault === 'number' && partnerDefault > 0 ? partnerDefault : FALLBACK_COMMISSION_RATE_PCT,
    recurringMonths: AFFILIATE_RECURRING_MONTHS,
    customerTier: 'BASIC',
  };
}
