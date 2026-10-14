/**
 * Cloudflare Edge Region Classifications & Airport IATA Colo Map
 *
 * Layer: seed/types
 */

import type { EnterpriseLocale } from './locales';

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
