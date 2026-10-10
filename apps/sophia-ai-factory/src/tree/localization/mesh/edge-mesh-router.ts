/**
 * Edge Mesh Localization & SWR KV Router
 *
 * Implements Anycast edge routing decisions, SWR caching, and path formatting.
 *
 * Layer: tree/localization/mesh
 */

import {
  ENTERPRISE_12_LOCALES,
  type EnterpriseLocale,
  type EdgeRoutingDecision,
  isEnterpriseLocale,
  isRtlLocale,
} from '@/seed/types/edge-mesh';
import type { EdgeRequestHeaders, EdgeKvStore } from './types';
import {
  extractColoFromRay,
  resolveEdgeMeshRegion,
  parseEnterpriseAcceptLanguage,
} from './latency-evaluator';
import {
  extractLocaleFromCookie,
  extractLocaleFromPathname,
  resolveEnterpriseLocale,
} from './mesh-failover';

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
 * Build Stale-While-Revalidate (SWR) HTTP Cache Headers for sub-50ms edge delivery.
 */
export function buildSwrCacheHeaders(
  ttlSeconds = 300,
  swrSeconds = 86400,
): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=0, s-maxage=${ttlSeconds}, stale-while-revalidate=${swrSeconds}`,
    'Cloudflare-CDN-Cache-Control': `max-age=${ttlSeconds}, stale-while-revalidate=${swrSeconds}`,
  };
}

/**
 * Generate a deterministically hashed KV cache key for edge routing decisions.
 */
export function buildEdgeRouteCacheKey(headers: EdgeRequestHeaders): string {
  const country = (headers.ipCountry ?? 'XX').toUpperCase().trim();
  const colo = extractColoFromRay(headers.cfRay);
  const cookie = extractLocaleFromCookie(headers.cookie) ?? 'none';
  const path = extractLocaleFromPathname(headers.pathname) ?? 'none';
  const firstLang = parseEnterpriseAcceptLanguage(headers.acceptLanguage)[0]?.primaryCode ?? 'none';

  return `edge_route:v1:${country}:${colo}:${firstLang}:${cookie}:${path}`;
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

/**
 * Format a URL path with a target Enterprise 12 locale prefix.
 * e.g. ('/pricing', 'ar') -> '/ar/pricing'
 * e.g. ('/vi/dashboard', 'fr') -> '/fr/dashboard'
 * e.g. ('/', 'zh') -> '/zh'
 */
export function formatLocalizedEnterprisePath(
  pathname: string,
  targetLocale: EnterpriseLocale,
): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return `/${targetLocale}`;
  }

  if (isEnterpriseLocale(segments[0])) {
    segments[0] = targetLocale;
    return `/${segments.join('/')}`;
  }

  return `/${targetLocale}/${segments.join('/')}`;
}
