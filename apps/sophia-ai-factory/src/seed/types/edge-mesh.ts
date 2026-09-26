/**
 * Pure Seed Types for Anycast Sub-50ms Edge Mesh & Enterprise 12-Language Router
 *
 * Layer: seed (pure primitives, schemas, constants, zero side-effects, no upper-layer imports)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module seed/types/edge-mesh
 */

/**
 * The 12 canonical enterprise locales supported by Sophia AI Factory.
 * Covers APAC (EN, VI, JA, KO, TH, ID), Greater China (ZH), Europe (ES, FR, DE),
 * South Asia (HI), and Middle East & North Africa (AR).
 */
export const ENTERPRISE_12_LOCALES = [
  'en',
  'vi',
  'ja',
  'ko',
  'zh',
  'es',
  'fr',
  'de',
  'th',
  'id',
  'hi',
  'ar',
] as const;

export type EnterpriseLocale = (typeof ENTERPRISE_12_LOCALES)[number];

/**
 * Locales requiring Right-to-Left (RTL) text flow and bidirectional layout isolation.
 */
export const RTL_LOCALES: readonly EnterpriseLocale[] = ['ar'] as const;

/**
 * Fast O(1) predicate to determine if a locale string requires Right-To-Left layout.
 */
export function isRtlLocale(locale: string | null | undefined): boolean {
  if (!locale) return false;
  const base = locale.toLowerCase().trim().split(/[-_]/)[0];
  return (RTL_LOCALES as readonly string[]).includes(base);
}

/**
 * Check if a given string is a valid supported Enterprise 12 locale.
 */
export function isEnterpriseLocale(locale: string | null | undefined): locale is EnterpriseLocale {
  if (!locale) return false;
  const normalized = locale.toLowerCase().trim().split(/[-_]/)[0];
  return (ENTERPRISE_12_LOCALES as readonly string[]).includes(normalized);
}

/**
 * Cloudflare Edge Region classifications for Anycast routing & PoP proximity.
 */
export type EdgeMeshRegion =
  | 'apac'
  | 'us'
  | 'eu'
  | 'middle_east'
  | 'latam'
  | 'global';

/**
 * Anycast Routing Decision produced at the Cloudflare Worker edge.
 */
export interface EdgeRoutingDecision {
  detectedLocale: EnterpriseLocale;
  isRtl: boolean;
  countryCode: string;
  coloCode: string;
  edgeRegion: EdgeMeshRegion;
  routeCacheTtlSeconds: number;
  resolutionSource: 'cookie' | 'path' | 'accept-language' | 'geo-ip' | 'fallback';
}

/**
 * Mapping of Cloudflare Airport IATA Colo Codes to Edge Mesh Regions.
 */
export const COLO_TO_REGION_MAP: Readonly<Record<string, EdgeMeshRegion>> = {
  // APAC
  SIN: 'apac', // Singapore
  HAN: 'apac', // Hanoi
  SGN: 'apac', // Ho Chi Minh City
  DAD: 'apac', // Da Nang
  NRT: 'apac', // Tokyo Narita
  HND: 'apac', // Tokyo Haneda
  KIX: 'apac', // Osaka
  ICN: 'apac', // Seoul
  BKK: 'apac', // Bangkok
  CGK: 'apac', // Jakarta
  DPS: 'apac', // Bali
  HKG: 'apac', // Hong Kong
  TPE: 'apac', // Taipei
  MNL: 'apac', // Manila
  KUL: 'apac', // Kuala Lumpur
  BOM: 'apac', // Mumbai
  DEL: 'apac', // New Delhi
  SYD: 'apac', // Sydney
  MEL: 'apac', // Melbourne

  // Europe
  LHR: 'eu', // London Heathrow
  LGW: 'eu', // London Gatwick
  FRA: 'eu', // Frankfurt
  CDG: 'eu', // Paris Charles de Gaulle
  AMS: 'eu', // Amsterdam
  MAD: 'eu', // Madrid
  BCN: 'eu', // Barcelona
  MXP: 'eu', // Milan
  ZRH: 'eu', // Zurich
  VIE: 'eu', // Vienna
  DUB: 'eu', // Dublin
  WAW: 'eu', // Warsaw
  ARN: 'eu', // Stockholm

  // US & North America
  IAD: 'us', // Washington DC
  EWR: 'us', // Newark
  JFK: 'us', // New York
  ORD: 'us', // Chicago
  DFW: 'us', // Dallas
  ATL: 'us', // Atlanta
  MIA: 'us', // Miami
  SFO: 'us', // San Francisco
  SJC: 'us', // San Jose
  LAX: 'us', // Los Angeles
  SEA: 'us', // Seattle
  YUL: 'us', // Montreal
  YYZ: 'us', // Toronto
  YVR: 'us', // Vancouver

  // Middle East & North Africa
  DXB: 'middle_east', // Dubai
  AUH: 'middle_east', // Abu Dhabi
  DOH: 'middle_east', // Doha
  RUH: 'middle_east', // Riyadh
  JED: 'middle_east', // Jeddah
  KWI: 'middle_east', // Kuwait City
  CAI: 'middle_east', // Cairo
  MCT: 'middle_east', // Muscat
  BAH: 'middle_east', // Bahrain

  // Latin America
  GRU: 'latam', // Sao Paulo
  GIG: 'latam', // Rio de Janeiro
  BOG: 'latam', // Bogota
  SCL: 'latam', // Santiago
  EZE: 'latam', // Buenos Aires
  MEX: 'latam', // Mexico City
  QRO: 'latam', // Queretaro
  LIM: 'latam', // Lima
};

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
