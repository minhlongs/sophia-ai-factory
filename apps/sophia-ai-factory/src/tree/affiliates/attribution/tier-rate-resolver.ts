/**
 * Customer-Tier Commission Rate Resolution (Attribution Path)
 *
 * The commission rate follows the *referred customer's* subscription tier,
 * not the referring partner's. A partner that refers an ENTERPRISE customer
 * earns 20% while a partner referring a BASIC customer earns 30%, because
 * enterprise gross value carries lower margin.
 *
 * This is the tree-side mirror of `land/affiliates/rate-resolver`. The
 * resolution logic lives in seed config (`AFFILIATE_RATE_BY_TIER`), which
 * both modules read, so the two stay identical by construction rather than
 * by convention.
 *
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/tier-rate-resolver
 */

import type { Tier } from '@/seed/types';
import type { AffiliatePartnerRow } from '@/seed/types/affiliate';
import {
  AFFILIATE_RATE_BY_TIER,
  AFFILIATE_RECURRING_MONTHS,
} from '@/seed/config/revenue-share';

/** Commission terms selected for a single attribution event. */
export interface ResolvedTierRate {
  /** Commission percentage expressed 0-100 (e.g. 30 = 30%). */
  ratePct: number;
  /** Number of recurring months earned. 0 means a one-time commission. */
  recurringMonths: number;
  /** Customer tier that selected the rate. */
  customerTier: Tier;
}

/**
 * Resolves the rate for a referred customer's tier. MASTER is compensated
 * once (0 months) because a MASTER subscription has no recurring share.
 */
export function resolveRateForTier(customerTier: Tier): ResolvedTierRate {
  const isMaster = customerTier === 'MASTER';
  return {
    ratePct: AFFILIATE_RATE_BY_TIER[customerTier],
    recurringMonths: isMaster ? 0 : AFFILIATE_RECURRING_MONTHS,
    customerTier,
  };
}

/**
 * Selects the attribution rate in precedence order:
 *   1. an explicit `custom_rate_override_pct` on the partner (operator-set
 *      manual override) always wins;
 *   2. the referred customer's tier rate;
 *   3. the partner's own default rate when the customer tier is unknown.
 *
 * Never throws — every branch yields a concrete number so that a malformed
 * partner row cannot abort a payment webhook.
 */
export function resolveAttributionRate(
  params: {
    customerTier?: Tier | null;
    partner: Pick<AffiliatePartnerRow, 'commission_rate_pct' | 'custom_rate_override_pct'>;
  },
): ResolvedTierRate {
  const overridePct = params.partner.custom_rate_override_pct;
  if (typeof overridePct === 'number' && overridePct > 0) {
    return {
      ratePct: overridePct,
      recurringMonths: AFFILIATE_RECURRING_MONTHS,
      customerTier: params.customerTier ?? 'BASIC',
    };
  }

  if (params.customerTier) {
    return resolveRateForTier(params.customerTier);
  }

  const partnerDefault = params.partner.commission_rate_pct;
  return {
    ratePct: typeof partnerDefault === 'number' && partnerDefault > 0 ? partnerDefault : AFFILIATE_RATE_BY_TIER.BASIC,
    recurringMonths: AFFILIATE_RECURRING_MONTHS,
    customerTier: 'BASIC',
  };
}
