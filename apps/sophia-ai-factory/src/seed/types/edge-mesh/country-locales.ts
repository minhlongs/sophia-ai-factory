/**
 * ISO 3166-1 alpha-2 Country Codes to Enterprise Locale Mapping
 *
 * Layer: seed/types
 */

import type { EnterpriseLocale } from './locales';

/**
 * Mapping of ISO 3166-1 alpha-2 country codes to primary Enterprise 12 locales.
 */
export const COUNTRY_TO_ENTERPRISE_LOCALE_MAP: Readonly<Record<string, EnterpriseLocale>> = {
  // Vietnam
  VN: 'vi',

  // Japan
  JP: 'ja',

  // South Korea
  KR: 'ko',

  // Thailand
  TH: 'th',

  // Indonesia
  ID: 'id',

  // China, Taiwan, Hong Kong
  CN: 'zh',
  TW: 'zh',
  HK: 'zh',
  MO: 'zh',

  // Spanish Speaking (Spain & Latin America)
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  VE: 'es',
  EC: 'es',
  GT: 'es',
  CR: 'es',
  UY: 'es',

  // French Speaking
  FR: 'fr',
  BE: 'fr',
  MC: 'fr',
  SN: 'fr',
  CI: 'fr',

  // German Speaking
  DE: 'de',
  AT: 'de',
  CH: 'de',
  LI: 'de',

  // India (Primary official Hindi, English fallback)
  IN: 'hi',

  // Arabic Speaking (MENA)
  SA: 'ar',
  AE: 'ar',
  EG: 'ar',
  QA: 'ar',
  KW: 'ar',
  OM: 'ar',
  BH: 'ar',
  JO: 'ar',
  LB: 'ar',
  MA: 'ar',
  DZ: 'ar',
  IQ: 'ar',

  // English-speaking Primary Markets
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  SG: 'en',
  MY: 'en',
  PH: 'en',
  IE: 'en',
  ZA: 'en',
};
