/**
 * Nearest Edge POP Colo & Geo Routing Engine
 * Layer: tree/cdn
 *
 * @module tree/cdn/mesh/pop-resolver
 */

import type { PopColo, EdgeDiscoverQuery } from '@/tree/cdn/types';
import { EDGE_POP_CATALOG } from '@/tree/cdn/types';

/**
 * Calculates great-circle distance between two geographical points using Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const COUNTRY_TO_POP_CODE: Readonly<Record<string, string>> = {
  VN: 'SGN',
  SG: 'SIN',
  JP: 'NRT',
  HK: 'HKG',
  US: 'SFO',
  GB: 'LHR',
  UK: 'LHR',
  DE: 'FRA',
  TH: 'SIN',
  ID: 'SIN',
  MY: 'SIN',
  PH: 'SIN',
  KR: 'SIN',
  TW: 'SIN',
  AU: 'SIN',
  IN: 'SIN',
  FR: 'FRA',
  ES: 'FRA',
  IT: 'FRA',
  NL: 'FRA',
  CH: 'FRA',
  CA: 'IAD',
  MX: 'IAD',
  BR: 'IAD',
};

function resolvePopByCoordinates(lat: number, lon: number): PopColo {
  let closestPop: PopColo = EDGE_POP_CATALOG[0]!;
  let minDistance = Infinity;

  for (const pop of EDGE_POP_CATALOG) {
    const dist = calculateHaversineDistanceKm(lat, lon, pop.coordinates.lat, pop.coordinates.lon);
    if (dist < minDistance) {
      minDistance = dist;
      closestPop = pop;
    }
  }

  return closestPop;
}

/**
 * Resolves the nearest Edge POP point of presence based on client hints:
 * 1. Explicit client colo code (e.g. SGN, SIN, NRT, SFO)
 * 2. Client latitude and longitude via Haversine distance
 * 3. Client ISO country code
 * 4. Preferred region (apac, us, eu)
 * 5. Default fallback to APAC regional hub (SIN)
 */
export function resolveNearestPopColo(query: EdgeDiscoverQuery): PopColo {
  if (query.clientColo) {
    const upperColo = query.clientColo.trim().toUpperCase();
    const matched = EDGE_POP_CATALOG.find((p) => p.code === upperColo);
    if (matched) return matched;
  }

  if (query.clientCoordinates && !isNaN(query.clientCoordinates.lat) && !isNaN(query.clientCoordinates.lon)) {
    return resolvePopByCoordinates(query.clientCoordinates.lat, query.clientCoordinates.lon);
  }

  if (query.clientCountry) {
    const country = query.clientCountry.trim().toUpperCase();
    const matchedCode = COUNTRY_TO_POP_CODE[country];
    if (matchedCode) {
      const pop = EDGE_POP_CATALOG.find((p) => p.code === matchedCode);
      if (pop) return pop;
    }
  }

  if (query.preferredRegion) {
    const reg = query.preferredRegion.toLowerCase();
    const regionPops = EDGE_POP_CATALOG.filter((p) => p.region === reg);
    if (regionPops.length > 0) {
      return regionPops[0]!;
    }
  }

  return EDGE_POP_CATALOG.find((p) => p.code === 'SIN')!;
}
