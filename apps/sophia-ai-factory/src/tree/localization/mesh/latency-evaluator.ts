/**
 * Edge Mesh Latency & PoP Evaluator
 *
 * Implements Ray PoP extraction, Colo-to-Region mapping, and Accept-Language parsing.
 *
 * Layer: tree/localization/mesh
 */

import {
  type EdgeMeshRegion,
  COLO_TO_REGION_MAP,
  COUNTRY_TO_ENTERPRISE_LOCALE_MAP,
} from '@/seed/types/edge-mesh';
import type { ParsedLanguageWeight } from './types';

function parseQualityWeight(params: string[]): number {
  for (const param of params) {
    const [key, val] = param.trim().split('=');
    if (key?.trim() === 'q') {
      const trimmedVal = val?.trim();
      const parsedQ = trimmedVal ? parseFloat(trimmedVal) : NaN;
      return Number.isFinite(parsedQ) && parsedQ >= 0 && parsedQ <= 1 ? parsedQ : 0.0;
    }
  }
  return 1.0;
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

    const q = parseQualityWeight(params);
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
