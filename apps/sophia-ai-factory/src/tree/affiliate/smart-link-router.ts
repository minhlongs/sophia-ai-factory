/**
 * Smart-Link Geo-Routing (`CF-IPCountry`) + Weighted A/B Offer Rotator.
 *
 * Replaces Dub.co Business ($90/mo) and Voluum Smartlink ($119+/mo) on Cloudflare
 * Workers at $0 extra operator cost. Crucial for Crypto + SaaS affiliates where
 * exchanges/offers vary by jurisdiction (e.g. US vs EU vs VN/Global).
 *
 * @module tree/affiliate/smart-link-router
 */

export interface SmartLinkDestination {
  readonly id: string;
  readonly url: string;
  readonly weight: number;
  readonly countries?: readonly string[]; // ISO-3166-1 alpha-2 uppercase, e.g. ['US', 'CA']
  readonly healthy?: boolean;
}

export interface SmartLinkRouteResult {
  readonly selectedId: string;
  readonly url: string;
  readonly matchedBy: 'geo_weighted' | 'global_weighted' | 'fallback';
}

function deterministicBucket(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function pickWeighted(
  candidates: readonly SmartLinkDestination[],
  seed: string,
): SmartLinkDestination {
  const totalWeight = candidates.reduce((sum, item) => sum + Math.max(1, item.weight), 0);
  let target = deterministicBucket(seed) * totalWeight;
  for (const item of candidates) {
    target -= Math.max(1, item.weight);
    if (target <= 0) return item;
  }
  return candidates[candidates.length - 1];
}

export function resolveSmartLinkDestination(args: {
  readonly destinations: readonly SmartLinkDestination[];
  readonly fallbackUrl: string;
  readonly countryCode?: string | null;
  readonly visitorSeed: string;
}): SmartLinkRouteResult {
  const healthy = args.destinations.filter((d) => d.healthy !== false);
  const country = args.countryCode?.trim().toUpperCase() || '';

  if (country) {
    const geoMatches = healthy.filter(
      (d) => Array.isArray(d.countries) && d.countries.length > 0 && d.countries.includes(country),
    );
    if (geoMatches.length > 0) {
      const picked = pickWeighted(geoMatches, args.visitorSeed);
      return { selectedId: picked.id, url: picked.url, matchedBy: 'geo_weighted' };
    }
  }

  const globalPool = healthy.filter((d) => !d.countries || d.countries.length === 0);
  if (globalPool.length > 0) {
    const picked = pickWeighted(globalPool, args.visitorSeed);
    return { selectedId: picked.id, url: picked.url, matchedBy: 'global_weighted' };
  }

  return {
    selectedId: 'fallback',
    url: args.fallbackUrl,
    matchedBy: 'fallback',
  };
}
