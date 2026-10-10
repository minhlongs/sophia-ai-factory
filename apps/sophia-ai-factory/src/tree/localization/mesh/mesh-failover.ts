/**
 * Edge Mesh Locale Negotiation & Fallback Resolver
 *
 * Implements cookie, pathname, and multi-source tiered locale negotiation.
 *
 * Layer: tree/localization/mesh
 */

import {
  type EnterpriseLocale,
  type EdgeRoutingDecision,
  COUNTRY_TO_ENTERPRISE_LOCALE_MAP,
  isEnterpriseLocale,
} from '@/seed/types/edge-mesh';
import { parseEnterpriseAcceptLanguage } from './latency-evaluator';

/**
 * Extract locale from cookie header if present.
 * Looks for `NEXT_LOCALE` or `locale` cookie.
 */
export function extractLocaleFromCookie(cookieHeader: string | null | undefined): EnterpriseLocale | null {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, rawVal] = cookie.trim().split('=');
    const name = rawName?.trim();
    const val = rawVal?.trim();
    if ((name === 'NEXT_LOCALE' || name === 'locale') && isEnterpriseLocale(val)) {
      return val.toLowerCase() as EnterpriseLocale;
    }
  }
  return null;
}

/**
 * Extract locale from URL pathname if it starts with a supported locale prefix.
 * e.g. "/ar/pricing" -> "ar"
 */
export function extractLocaleFromPathname(pathname: string | null | undefined): EnterpriseLocale | null {
  if (!pathname || typeof pathname !== 'string') return null;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && isEnterpriseLocale(segments[0])) {
    return segments[0].toLowerCase() as EnterpriseLocale;
  }
  return null;
}

/**
 * Resolve Enterprise 12 Locale using tiered multi-source negotiation:
 * 1. Path prefix (explicit user routing)
 * 2. Cookie preference (explicit user choice stored in session)
 * 3. High-weight Accept-Language (q >= 0.85) matching supported locale
 * 4. Geo-IP Country Mapping (unambiguous country-to-locale)
 * 5. Best matching Accept-Language (any q > 0)
 * 6. Edge Mesh Region fallback
 * 7. Default locale ('vi' for VN IP, otherwise 'en')
 */
export function resolveEnterpriseLocale(params: {
  geoCountry?: string | null;
  acceptLanguage?: string | null;
  cookieLocale?: string | null;
  pathLocale?: string | null;
}): { locale: EnterpriseLocale; source: EdgeRoutingDecision['resolutionSource'] } {
  // 1. Explicit path locale
  if (params.pathLocale && isEnterpriseLocale(params.pathLocale)) {
    return { locale: params.pathLocale, source: 'path' };
  }

  // 2. Explicit cookie preference
  if (params.cookieLocale && isEnterpriseLocale(params.cookieLocale)) {
    return { locale: params.cookieLocale, source: 'cookie' };
  }

  const parsedLangs = parseEnterpriseAcceptLanguage(params.acceptLanguage);
  const matchedBrowserEntries = parsedLangs.filter(entry => isEnterpriseLocale(entry.primaryCode));
  const primaryBrowserMatch = matchedBrowserEntries[0] ?? null;

  // 3. High-weight Accept-Language (q >= 0.85)
  if (primaryBrowserMatch && primaryBrowserMatch.q >= 0.85) {
    return {
      locale: primaryBrowserMatch.primaryCode as EnterpriseLocale,
      source: 'accept-language',
    };
  }

  // 4. Geo-IP Country Mapping
  if (params.geoCountry) {
    const geoMapped = COUNTRY_TO_ENTERPRISE_LOCALE_MAP[params.geoCountry.toUpperCase().trim()];
    if (geoMapped) {
      return { locale: geoMapped, source: 'geo-ip' };
    }
  }

  // 5. Best matching Accept-Language
  if (primaryBrowserMatch) {
    return {
      locale: primaryBrowserMatch.primaryCode as EnterpriseLocale,
      source: 'accept-language',
    };
  }

  // 6. Default Fallback
  const isVn = params.geoCountry?.toUpperCase().trim() === 'VN';
  return {
    locale: isVn ? 'vi' : 'en',
    source: 'fallback',
  };
}
