/**
 * Edge Mesh Cache & Path Helpers
 *
 * Provides SWR cache header construction, KV cache key hashing,
 * and Enterprise 12 localized URL path formatting.
 *
 * Layer: tree/localization/mesh
 */

import {
  type EnterpriseLocale,
  isEnterpriseLocale,
} from '@/seed/types/edge-mesh';
import type { EdgeRequestHeaders } from './types';
import {
  extractColoFromRay,
  parseEnterpriseAcceptLanguage,
} from './latency-evaluator';
import {
  extractLocaleFromCookie,
  extractLocaleFromPathname,
} from './mesh-failover';

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
