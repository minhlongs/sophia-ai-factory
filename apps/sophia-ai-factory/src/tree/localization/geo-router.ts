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
import {
  COUNTRY_TO_LOCALE_MAP,
  parseAcceptLanguage,
  type ParsedLanguage,
} from './accept-language-parser';

export { COUNTRY_TO_LOCALE_MAP, parseAcceptLanguage, type ParsedLanguage };

/**
 * Check if a given string is a valid supported APAC locale.
 */
export function isApacLocale(locale: string | null | undefined): locale is ApacLocale {
  if (!locale) return false;
  return (APAC_LOCALES as readonly string[]).includes(locale.toLowerCase().trim());
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
 */
export function resolveApacLocale(
  geoCountry?: string | null,
  acceptLanguage?: string | null,
): ApacLocale {
  const geoLocale = getCountryDefaultLocale(geoCountry);
  const parsedLangs = parseAcceptLanguage(acceptLanguage);

  let matchedBrowserEntry: ParsedLanguage | null = null;
  for (const entry of parsedLangs) {
    if (isApacLocale(entry.primaryCode)) {
      matchedBrowserEntry = entry;
      break;
    }
  }
  const browserLocale: ApacLocale | null = (matchedBrowserEntry?.primaryCode as ApacLocale) ?? null;

  if (matchedBrowserEntry && matchedBrowserEntry.q >= 0.9) {
    return browserLocale!;
  }

  if (geoLocale) {
    if (['vi', 'ja', 'ko', 'th'].includes(geoLocale)) {
      return geoLocale;
    }
    if (browserLocale) {
      return browserLocale;
    }
    return geoLocale;
  }

  if (browserLocale) {
    return browserLocale;
  }

  if (geoCountry?.toUpperCase() === 'VN') {
    return 'vi';
  }

  return 'en';
}

/**
 * Format a URL path with a target APAC locale prefix.
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
