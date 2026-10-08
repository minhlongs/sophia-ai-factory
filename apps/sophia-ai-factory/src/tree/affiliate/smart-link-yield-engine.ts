/**
 * @file smart-link-yield-engine.ts
 * @description Zero-IO domain engine for Affiliate Smart-Link Yield Ranking & Geo Failover Routing
 * @layer tree
 */

import type {
  AffiliateOffer,
  SmartLinkMatchResult,
  AffiliateNetwork,
} from '@/seed/types/growth-triad-v6-types';

/**
 * Calculates Expected Value Yield per 1,000 video impressions.
 * EV = EPC * sqrt(Gravity) * (1 - RefundRate/100) * (CommissionPct/100) * NicheAlignment
 */
export function calculateExpectedYield(
  offer: AffiliateOffer,
  videoNiche: string
): number {
  const nicheMultiplier =
    offer.niche.toLowerCase() === videoNiche.toLowerCase() ? 1.0 : 0.65;

  const retentionFactor = Math.max(0, 1 - offer.refundRatePct / 100);
  const commissionFactor = Math.max(0.01, offer.commissionPct / 100);
  const gravityScale = Math.sqrt(Math.max(1, offer.gravity));

  const ev =
    offer.epcUsd * gravityScale * retentionFactor * commissionFactor * nicheMultiplier;

  return Number(ev.toFixed(2));
}

/**
 * Ranks offers by Expected Yield and selects optimal offer with fallback geo routing.
 */
export function matchBestYieldOffer(
  offers: AffiliateOffer[],
  videoNiche: string,
  userCountryCode = 'US'
): SmartLinkMatchResult | null {
  if (offers.length === 0) return null;

  const scored = offers.map((offer) => ({
    offer,
    yieldUsd: calculateExpectedYield(offer, videoNiche),
  }));

  scored.sort((a, b) => b.yieldUsd - a.yieldUsd);
  const best = scored[0];

  // Fallback network selection if primary network is restricted in country
  const fallbackNetwork: AffiliateNetwork =
    best.offer.network === 'TIKTOK_SHOP' && userCountryCode !== 'US' && userCountryCode !== 'UK'
      ? 'CLICKBANK'
      : best.offer.network === 'CLICKBANK'
      ? 'AMAZON'
      : 'CJ';

  // Construct Smart-Link router redirect URL
  const geoRoutingUrl = `https://sophia.agencyos.network/api/r/${best.offer.id}?geo=${userCountryCode.toUpperCase()}&yield=${best.yieldUsd}`;

  return {
    offerId: best.offer.id,
    offerName: best.offer.name,
    expectedYieldUsd: best.yieldUsd,
    geoRoutingUrl,
    fallbackNetwork,
  };
}
