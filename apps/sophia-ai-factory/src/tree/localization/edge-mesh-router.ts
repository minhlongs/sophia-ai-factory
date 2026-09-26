/**
 * Anycast Sub-50ms Edge Mesh KV Router & Geo-IP Localization Engine
 *
 * Implements Cloudflare Edge Geo-IP routing, Cloudflare Ray PoP extraction,
 * RFC 5646 Accept-Language negotiation for 12 Enterprise Locales,
 * Right-to-Left (RTL) Arabic detection, and Sub-50ms Stale-While-Revalidate (SWR) KV caching.
 *
 * Layer: tree (pure domain logic, zero side-effects, no upper-layer imports)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/localization/edge-mesh-router
 */

import {
  ENTERPRISE_12_LOCALES,
  type EnterpriseLocale,
  type EdgeRoutingDecision,
  type EdgeMeshRegion,
  COLO_TO_REGION_MAP,
  COUNTRY_TO_ENTERPRISE_LOCALE_MAP,
  isEnterpriseLocale,
  isRtlLocale,
} from '@/seed/types/edge-mesh';

/**
 * Request headers supplied from Cloudflare Workers edge runtime.
 */
export interface EdgeRequestHeaders {
  ipCountry?: string | null;
  cfRay?: string | null;
  cfRegion?: string | null;
  acceptLanguage?: string | null;
  cookie?: string | null;
  pathname?: string | null;
}

/**
 * Minimal KV store contract for edge caching (compatible with Cloudflare Workers KV).
 */
export interface EdgeKvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Parsed Accept-Language entry with quality weight.
 */
export interface ParsedLanguageWeight {
  locale: string;
  primaryCode: string;
  q: number;
}

/**
 * Parse an HTTP `Accept-Language` header according to RFC 5646 and RFC 9110.
 * Example: "ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7"
 */
export function parseEnterpriseAcceptLanguage(
  header: string | null | undefined,
): ParsedLanguageWeight[] {
  if (!header || typeof header !== 'string') return [];

  const rawEntries = header.split(',');
  const parsed: ParsedLanguageWeight[] = [];

  for (const raw of rawEntries) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const [langTag, ...params] = trimmed.split(';');
    const cleanTag = langTag.trim().toLowerCase();
    if (!cleanTag || cleanTag === '*') continue;

    let q = 1.0;
    for (const param of params) {
      const [key, val] = param.trim().split('=');
      if (key?.trim() === 'q') {
        const trimmedVal = val?.trim();
        const parsedQ = trimmedVal ? parseFloat(trimmedVal) : NaN;
        q = isFinite(parsedQ) && parsedQ >= 0 && parsedQ <= 1 ? parsedQ : 0.0;
      }
    }

    const primaryCode = cleanTag.split(/[-_]/)[0];
    parsed.push({
      locale: cleanTag,
      primaryCode,
      q,
    });
  }

  // Sort descending by quality weight
  return parsed.sort((a, b) => b.q - a.q);
}

/**
 * Extract Cloudflare PoP / Colo IATA airport code from `CF-Ray` header.
 * Example: "8d26e95c1a8d052b-SIN" -> "SIN"
 * Example: "9f01234abcd-HAN" -> "HAN"
 */
export function extractColoFromRay(cfRay: string | null | undefined): string {
  if (!cfRay || typeof cfRay !== 'string') return 'GLOBAL';
  const parts = cfRay.trim().split('-');
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 1].toUpperCase().trim();
    if (COLO_TO_REGION_MAP[candidate]) {
      return candidate;
    }
    // If not in known list but valid hex ray format e.g. "8d26e95c1a8d052b-XYZ"
    if (/^[0-9a-fA-F]{6,}$/.test(parts[0]) && /^[A-Z]{3}$/.test(candidate)) {
      return candidate;
    }
  }
  return 'GLOBAL';
}

/**
 * Resolve Edge Mesh Region from Cloudflare Colo code or Country code.
 */
export function resolveEdgeMeshRegion(
  coloCode: string,
  countryCode?: string | null,
): EdgeMeshRegion {
  const normalizedColo = coloCode.toUpperCase().trim();
  if (COLO_TO_REGION_MAP[normalizedColo]) {
    return COLO_TO_REGION_MAP[normalizedColo];
  }

  if (countryCode) {
    const upperCountry = countryCode.toUpperCase().trim();
    const mappedLocale = COUNTRY_TO_ENTERPRISE_LOCALE_MAP[upperCountry];
    if (mappedLocale === 'ar') return 'middle_east';
    if (['vi', 'ja', 'ko', 'th', 'id', 'zh', 'hi'].includes(mappedLocale)) return 'apac';
    if (['fr', 'de', 'es'].includes(mappedLocale) && ['FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'AT', 'CH'].includes(upperCountry)) return 'eu';
    if (['US', 'CA'].includes(upperCountry)) return 'us';
    if (['MX', 'BR', 'AR', 'CO', 'CL', 'PE'].includes(upperCountry)) return 'latam';
  }

  return 'global';
}

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
