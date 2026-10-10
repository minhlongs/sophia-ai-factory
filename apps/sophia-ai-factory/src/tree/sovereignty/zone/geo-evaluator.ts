import type { SovereignZoneCode } from '@/seed/types/sovereign-vault';
import { SOVEREIGN_ZONE_CONFIGS } from './types';

/** EU / EEA Member Country ISO codes */
export const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  'IS', 'LI', 'NO', 'CH', 'GB', // EEA & aligned privacy regimes
]);

/** ASEAN countries mapped to Singapore Hub */
export const SG_HUB_COUNTRY_CODES = new Set(['SG', 'MY', 'ID', 'TH', 'PH', 'BN', 'KH', 'LA', 'MM']);

export const DIRECT_COUNTRY_ZONE_MAP: Record<string, SovereignZoneCode> = {
  VN: 'VN',
  JP: 'APAC_JP',
  US: 'US',
  CA: 'US',
};

export const DIRECT_REGION_ZONE_MAP: Record<string, SovereignZoneCode> = {
  EU: 'EU',
  VN: 'VN',
  SG: 'APAC_SG',
  APAC_SG: 'APAC_SG',
  JP: 'APAC_JP',
  APAC_JP: 'APAC_JP',
  US: 'US',
};

/**
 * Validates whether a zone string is a recognized SovereignZoneCode.
 */
export function isValidZoneCode(code: string): code is SovereignZoneCode {
  return code in SOVEREIGN_ZONE_CONFIGS;
}

/**
 * Resolves the Sovereign Zone Code based on country and optional region codes.
 * Inspects ISO-3166-1 alpha-2 codes (e.g. from Cloudflare's `cf-ipcountry` header).
 */
export function resolveSovereignZone(
  countryCode?: string | null,
  regionCode?: string | null,
): SovereignZoneCode {
  if (countryCode && countryCode.trim()) {
    const normalizedCountry = countryCode.trim().toUpperCase();

    const direct = DIRECT_COUNTRY_ZONE_MAP[normalizedCountry];
    if (direct) return direct;

    if (EU_COUNTRY_CODES.has(normalizedCountry)) return 'EU';
    if (SG_HUB_COUNTRY_CODES.has(normalizedCountry)) return 'APAC_SG';
  }

  if (regionCode && regionCode.trim()) {
    const normRegion = regionCode.trim().toUpperCase();
    const regionZone = DIRECT_REGION_ZONE_MAP[normRegion];
    if (regionZone) return regionZone;
  }

  return 'GLOBAL';
}

/**
 * Extracts sovereign zone from standard edge HTTP headers.
 */
export function extractZoneFromHeaders(headers: Headers): SovereignZoneCode {
  const explicitZone = headers.get('x-sovereign-zone');
  if (explicitZone && isValidZoneCode(explicitZone)) {
    return explicitZone as SovereignZoneCode;
  }

  const country = headers.get('cf-ipcountry') || headers.get('x-country-code');
  const region = headers.get('cf-region-code') || headers.get('x-region-code');

  return resolveSovereignZone(country, region);
}
