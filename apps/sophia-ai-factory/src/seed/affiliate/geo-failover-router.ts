/**
 * Edge Affiliate Geo-Routing, WAF-Aware Link Health & Smart Offer Failover.
 *
 * Clean-room pure-TS engine (MIT/Apache-2.0 patterns from ccvar/cligc_link,
 * connor4312/cockatiel, and Stackbilt-dev/llm-providers):
 * - Routes by `request.cf.country` (e.g., US/UK/VN crypto restrictions).
 * - Requires >=2 consecutive hard failures (404/410/5xx) to trip breaker;
 *   classifies 401/403/429 as WAF-blocked (non-tripping) to avoid false dead-link trips.
 *
 * Layer: seed/affiliate (pure deterministic routing & breaker state, zero deps)
 *
 * @module seed/affiliate/geo-failover-router
 */

export type BreakerState = 'closed' | 'open' | 'half_open';

export interface OfferTarget {
  readonly id: string;
  readonly url: string;
  readonly blockedCountries: readonly string[];
  readonly consecutiveHardFailures: number;
  readonly breakerState: BreakerState;
}

export interface GeoFailoverDecision {
  readonly selectedOfferId: string | null;
  readonly selectedUrl: string | null;
  readonly reason: string;
}

export function isHardLinkFailureStatus(httpStatus: number): boolean {
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) {
    return false; // WAF / rate-limit challenge — do not falsely mark offer dead
  }
  return httpStatus === 404 || httpStatus === 410 || httpStatus >= 500 || httpStatus === 0;
}

export function resolveGeoFailoverOffer(
  offerChain: readonly OfferTarget[],
  visitorCountry: string,
): GeoFailoverDecision {
  const country = visitorCountry.trim().toUpperCase() || 'GLOBAL';

  for (const offer of offerChain) {
    const isGeoBlocked = offer.blockedCountries.some((c) => c.toUpperCase() === country);
    if (isGeoBlocked) continue;
    if (
      offer.breakerState === 'open' ||
      (offer.breakerState === 'closed' && offer.consecutiveHardFailures >= 2)
    ) {
      continue;
    }

    return {
      selectedOfferId: offer.id,
      selectedUrl: offer.url,
      reason: `Matched healthy offer for ${country}`,
    };
  }

  return {
    selectedOfferId: null,
    selectedUrl: null,
    reason: `All ${offerChain.length} offers geo-blocked or circuit-open for ${country}`,
  };
}
