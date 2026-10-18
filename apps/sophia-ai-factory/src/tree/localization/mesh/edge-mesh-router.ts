/**
 * Edge Mesh Localization & SWR KV Router
 *
 * Implements Anycast edge routing decisions, SWR caching, and path formatting.
 *
 * Layer: tree/localization/mesh
 */

import {
  ENTERPRISE_12_LOCALES,
  type EdgeRoutingDecision,
  isRtlLocale,
} from '@/seed/types/edge-mesh';
import type { EdgeRequestHeaders, EdgeKvStore } from './types';
import {
  extractColoFromRay,
  resolveEdgeMeshRegion,
} from './latency-evaluator';
import {
  extractLocaleFromCookie,
  extractLocaleFromPathname,
  resolveEnterpriseLocale,
} from './mesh-failover';
import {
  buildSwrCacheHeaders,
  buildEdgeRouteCacheKey,
  formatLocalizedEnterprisePath,
} from './edge-route-helpers';

export {
  buildSwrCacheHeaders,
  buildEdgeRouteCacheKey,
  formatLocalizedEnterprisePath,
};

/**
 * Make an Anycast Edge Routing Decision for an incoming request.
 */
export function makeEdgeRoutingDecision(headers: EdgeRequestHeaders): EdgeRoutingDecision {
  const countryCode = (headers.ipCountry ?? 'XX').toUpperCase().trim();
  const coloCode = extractColoFromRay(headers.cfRay);
  const edgeRegion = resolveEdgeMeshRegion(coloCode, countryCode);

  const cookieLocale = extractLocaleFromCookie(headers.cookie);
  const pathLocale = extractLocaleFromPathname(headers.pathname);

  const { locale, source } = resolveEnterpriseLocale({
    geoCountry: countryCode !== 'XX' ? countryCode : null,
    acceptLanguage: headers.acceptLanguage,
    cookieLocale,
    pathLocale,
  });

  const isRtl = isRtlLocale(locale);

  return {
    detectedLocale: locale,
    isRtl,
    countryCode,
    coloCode,
    edgeRegion,
    routeCacheTtlSeconds: 300, // 5 minutes edge cache
    resolutionSource: source,
  };
}

/**
 * Resolve Edge Mesh Routing Decision with Sub-50ms KV Caching.
 * Reads from KV if available, falls back to in-memory computation and caches the result.
 */
export async function resolveEdgeRoutingWithKv(
  kv: EdgeKvStore | null | undefined,
  headers: EdgeRequestHeaders,
): Promise<EdgeRoutingDecision> {
  const cacheKey = buildEdgeRouteCacheKey(headers);

  if (kv) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as EdgeRoutingDecision;
        if (parsed.detectedLocale && ENTERPRISE_12_LOCALES.includes(parsed.detectedLocale)) {
          return parsed;
        }
      }
    } catch {
      // KV read failed or parse error — proceed to live evaluation
    }
  }

  const decision = makeEdgeRoutingDecision(headers);

  if (kv) {
    try {
      await kv.put(cacheKey, JSON.stringify(decision), {
        expirationTtl: decision.routeCacheTtlSeconds,
      });
    } catch {
      // KV write failure is non-fatal
    }
  }

  return decision;
}
