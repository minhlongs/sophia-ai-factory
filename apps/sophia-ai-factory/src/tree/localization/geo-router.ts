/**
 * Smart APAC Geo-Location & Accept-Language Localization Router
 *
 * Resolves visitor's preferred APAC locale ('vi' | 'en' | 'ja' | 'ko' | 'th')
 * from Cloudflare edge headers (`cf-ipcountry` and `accept-language`).
 *
 * Layer: tree (pure domain logic, zero side-effects, no upper-layer imports)
 *
 * @module tree/localization/geo-router
 */

import { APAC_LOCALES, type ApacLocale } from '@/seed/types/dubbing';

/**
 * Mapping of ISO 3166-1 alpha-2 country codes to primary APAC locales.
 */
export const COUNTRY_TO_LOCALE_MAP: Readonly<Record<string, ApacLocale>> = {
  // Vietnam
  VN: 'vi',
  // Japan
  JP: 'ja',
  // South Korea
  KR: 'ko',
  // Thailand
  TH: 'th',
  // English-speaking APAC & International primary markets
  SG: 'en',
  AU: 'en',
  NZ: 'en',
  PH: 'en',
  MY: 'en',
  IN: 'en',
  US: 'en',
  GB: 'en',
  CA: 'en',
};

/**
 * Check if a given string is a valid supported APAC locale.
 */
export function isApacLocale(locale: string | null | undefined): locale is ApacLocale {
  if (!locale) return false;
  return (APAC_LOCALES as readonly string[]).includes(locale.toLowerCase().trim());
}

/**
 * Parsed Accept-Language entry with quality weight.
 */
export interface ParsedLanguage {
  locale: string;
  primaryCode: string;
  q: number;
}

/**
 * Parse an HTTP `Accept-Language` header according to RFC 5646 and RFC 9110.
 * Example: "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
 */
export function parseAcceptLanguage(header: string | null | undefined): ParsedLanguage[] {
  if (!header || typeof header !== 'string') return [];

  const rawEntries = header.split(',');
  const parsed: ParsedLanguage[] = [];

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

    const primaryCode = cleanTag.split('-')[0];
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
 * Get default APAC locale for an ISO country code.
 */
export function getCountryDefaultLocale(countryCode: string | null | undefined): ApacLocale | null {
  if (!countryCode) return null;
  const upper = countryCode.trim().toUpperCase();
  return COUNTRY_TO_LOCALE_MAP[upper] ?? null;
}

/**
 * Smartly resolve the best APAC locale ('vi' | 'en' | 'ja' | 'ko' | 'th')
 * given edge geo country (e.g. from `cf-ipcountry`) and client `Accept-Language`.
 *
 * Precedence Rules:
 * 1. If `geoCountry` matches an unambiguous native APAC market (VN, JP, KR, TH):
 *    - If client's highest-preference Accept-Language explicitly requests a supported locale,
 *      honor browser language if valid.
 *    - Otherwise, default to the native market locale (e.g. VN -> vi, JP -> ja).
 * 2. If `geoCountry` is not a localized native market, check `Accept-Language` in quality order.
 * 3. Fallback:
 *    - If geo is VN, fallback to 'vi'.
 *    - Otherwise, default to 'en'.
 */
export function resolveApacLocale(
  geoCountry?: string | null,
  acceptLanguage?: string | null,
): ApacLocale {
  const geoLocale = getCountryDefaultLocale(geoCountry);
  const parsedLangs = parseAcceptLanguage(acceptLanguage);

  // Find first matching supported APAC locale in Accept-Language
  let matchedBrowserEntry: ParsedLanguage | null = null;
  for (const entry of parsedLangs) {
    if (isApacLocale(entry.primaryCode)) {
      matchedBrowserEntry = entry;
      break;
    }
  }
  const browserLocale: ApacLocale | null = (matchedBrowserEntry?.primaryCode as ApacLocale) ?? null;

  // If user has strong explicit browser locale preference (q >= 0.9 on the matched APAC language)
  if (matchedBrowserEntry && matchedBrowserEntry.q >= 0.9) {
    return browserLocale!;
  }

  // If geo location provides a specific regional locale, use it
  if (geoLocale) {
    // If browser locale also provided, prefer the browser if geo is purely international (e.g. SG/US -> en)
    if (['vi', 'ja', 'ko', 'th'].includes(geoLocale)) {
      return geoLocale;
    }
    if (browserLocale) {
      return browserLocale;
    }
    return geoLocale;
  }

  // If no geo match, use the best browser locale
  if (browserLocale) {
    return browserLocale;
  }

  // Default fallback: Vietnamese for Vietnam, otherwise English
  if (geoCountry?.toUpperCase() === 'VN') {
    return 'vi';
  }

  return 'en';
}

/**
 * Format a URL path with a target APAC locale prefix.
 * e.g. ('/pricing', 'ja') -> '/ja/pricing'
 * e.g. ('/vi/dashboard', 'ko') -> '/ko/dashboard'
 */
export function formatLocalizedPath(pathname: string, targetLocale: ApacLocale): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return `/${targetLocale}`;
  }

  if (isApacLocale(segments[0])) {
    segments[0] = targetLocale;
    return `/${segments.join('/')}`;
  }

  return `/${targetLocale}/${segments.join('/')}`;
}
