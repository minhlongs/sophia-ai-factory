/**
 * Sovereign Data Zone Router & Cross-Border Compliance Policy Engine
 *
 * Implements strict multi-jurisdiction data residency, geo-routing,
 * and cross-border transfer gates for:
 * - EU GDPR (Regulation 2016/679)
 * - Vietnam PDPD (Decree 13/2023/ND-CP) & CyberLaw 24
 * - Singapore PDPA 2012 / APAC Hub
 * - Japan APPI (Act on Protection of Personal Information)
 * - US CCPA / CPRA & Commercial Zone
 *
 * Layer: tree (Pure domain logic & policy enforcement)
 * Allowed imports: @/seed/*, standard libraries
 *
 * @module tree/sovereignty/sovereign-zone-router
 */

import type {
  SovereignZoneCode,
  RegulatoryFramework,
  CrossBorderTransferPolicy,
  CrossBorderValidationResult,
  SovereignDataZone,
} from '@/seed/types/sovereign-vault';

export interface SovereignZoneConfig {
  zoneCode: SovereignZoneCode;
  name: string;
  jurisdictionLegalName: string;
  regulatoryFramework: RegulatoryFramework;
  primaryStorageRegion: string;
  fallbackStorageRegion: string | null;
  crossBorderTransferPolicy: CrossBorderTransferPolicy;
  mandatoryCmek: boolean;
  retentionPeriodDays: number;
  auditRetentionDays: number;
}

/** Canonical Zone Configurations matching D1 0300 Seed */
export const SOVEREIGN_ZONE_CONFIGS: Record<SovereignZoneCode, SovereignZoneConfig> = {
  EU: {
    zoneCode: 'EU',
    name: 'European Sovereign Data Zone',
    jurisdictionLegalName: 'European Economic Area (GDPR)',
    regulatoryFramework: 'EU_GDPR',
    primaryStorageRegion: 'weur',
    fallbackStorageRegion: 'eeur',
    crossBorderTransferPolicy: 'adequacy_only',
    mandatoryCmek: true,
    retentionPeriodDays: 2555, // 7 years standard
    auditRetentionDays: 2555,
  },
  VN: {
    zoneCode: 'VN',
    name: 'Vietnam Sovereign Residency Zone',
    jurisdictionLegalName: 'Socialist Republic of Vietnam (Decree 13 & CyberLaw)',
    regulatoryFramework: 'VN_PDPD',
    primaryStorageRegion: 'apac-vn',
    fallbackStorageRegion: 'apac-sg',
    crossBorderTransferPolicy: 'strictly_prohibited',
    mandatoryCmek: true,
    retentionPeriodDays: 3650, // 10 years per Tax Law 38 / Circular TT78
    auditRetentionDays: 3650,
  },
  APAC_SG: {
    zoneCode: 'APAC_SG',
    name: 'Singapore APRA/PDPA Zone',
    jurisdictionLegalName: 'Republic of Singapore (PDPA 2012)',
    regulatoryFramework: 'SG_PDPA',
    primaryStorageRegion: 'apac-sg',
    fallbackStorageRegion: 'apac-jp',
    crossBorderTransferPolicy: 'explicit_consent_scc',
    mandatoryCmek: false,
    retentionPeriodDays: 2555,
    auditRetentionDays: 2555,
  },
  APAC_JP: {
    zoneCode: 'APAC_JP',
    name: 'Japan Sovereign Privacy Zone',
    jurisdictionLegalName: 'Japan (Act on the Protection of Personal Information)',
    regulatoryFramework: 'JP_APPI',
    primaryStorageRegion: 'apac-jp',
    fallbackStorageRegion: 'apac-sg',
    crossBorderTransferPolicy: 'adequacy_only',
    mandatoryCmek: false,
    retentionPeriodDays: 2555,
    auditRetentionDays: 2555,
  },
  US: {
    zoneCode: 'US',
    name: 'United States Commercial & CCPA Zone',
    jurisdictionLegalName: 'United States of America (CCPA/CPRA)',
    regulatoryFramework: 'US_CCPA',
    primaryStorageRegion: 'wnam',
    fallbackStorageRegion: 'enam',
    crossBorderTransferPolicy: 'unrestricted',
    mandatoryCmek: false,
    retentionPeriodDays: 2555,
    auditRetentionDays: 2555,
  },
  GLOBAL: {
    zoneCode: 'GLOBAL',
    name: 'Global Cross-Regional Default Zone',
    jurisdictionLegalName: 'International Common Law',
    regulatoryFramework: 'MULTI_JURISDICTION',
    primaryStorageRegion: 'auto',
    fallbackStorageRegion: null,
    crossBorderTransferPolicy: 'unrestricted',
    mandatoryCmek: false,
    retentionPeriodDays: 2555,
    auditRetentionDays: 2555,
  },
};

/** EU / EEA Member Country ISO codes */
const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  'IS', 'LI', 'NO', 'CH', 'GB', // EEA & aligned privacy regimes
]);

/** ASEAN countries mapped to Singapore Hub */
const SG_HUB_COUNTRY_CODES = new Set(['SG', 'MY', 'ID', 'TH', 'PH', 'BN', 'KH', 'LA', 'MM']);

const DIRECT_COUNTRY_ZONE_MAP: Record<string, SovereignZoneCode> = {
  VN: 'VN',
  JP: 'APAC_JP',
  US: 'US',
  CA: 'US',
};

const DIRECT_REGION_ZONE_MAP: Record<string, SovereignZoneCode> = {
  EU: 'EU',
  VN: 'VN',
  SG: 'APAC_SG',
  APAC_SG: 'APAC_SG',
  JP: 'APAC_JP',
  APAC_JP: 'APAC_JP',
  US: 'US',
};

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

/**
 * Validates whether a zone string is a recognized SovereignZoneCode.
 */
export function isValidZoneCode(code: string): code is SovereignZoneCode {
  return code in SOVEREIGN_ZONE_CONFIGS;
}

/**
 * Retrieves the authoritative policy configuration for a given sovereign zone.
 */
export function getZonePolicy(zoneCode: SovereignZoneCode): SovereignZoneConfig {
  return SOVEREIGN_ZONE_CONFIGS[zoneCode] ?? SOVEREIGN_ZONE_CONFIGS.GLOBAL;
}

/**
 * Validates whether data originating from `sourceZone` can be transferred
 * or processed in `targetZone` according to territorial data residency laws.
 */
export function validateCrossBorderTransfer(
  sourceZone: SovereignZoneCode,
  targetZone: SovereignZoneCode,
  options?: {
    hasExplicitConsent?: boolean;
    hasStandardContractualClauses?: boolean;
    transferPurpose?: string;
  },
): CrossBorderValidationResult {
  // Intra-zone transfers are always compliant
  if (sourceZone === targetZone) {
    return {
      allowed: true,
      sourceZone,
      targetZone,
      verdict: 'ALLOWED',
      reason: `Intra-zone data processing within sovereign perimeter ${sourceZone} is fully compliant.`,
    };
  }

  const sourceConfig = getZonePolicy(sourceZone);

  // 1. Vietnam Strict Prohibition Gate
  // Under Decree 13/2023/ND-CP Article 25 & CyberLaw 24, core customer data cannot leave Vietnam
  // without an approved A05 Dossier and Ministry of Public Security authorization.
  if (sourceConfig.crossBorderTransferPolicy === 'strictly_prohibited') {
    return {
      allowed: false,
      sourceZone,
      targetZone,
      verdict: 'DENIED',
      reason: `Violation of ${sourceConfig.regulatoryFramework} (Decree 13/2023/ND-CP & CyberLaw): Territorial data sovereignty strictly prohibits exporting data outside jurisdiction ${sourceZone} to ${targetZone}.`,
    };
  }

  // 2. Adequacy Only Policy (EU GDPR Art 45 & Japan APPI Art 28)
  if (sourceConfig.crossBorderTransferPolicy === 'adequacy_only') {
    // Mutual Adequacy between EU and Japan
    const isAdequatePair =
      (sourceZone === 'EU' && targetZone === 'APAC_JP') ||
      (sourceZone === 'APAC_JP' && targetZone === 'EU');

    if (isAdequatePair) {
      return {
        allowed: true,
        sourceZone,
        targetZone,
        verdict: 'ALLOWED',
        reason: `Compliant cross-border transfer under mutual adequacy recognition between ${sourceZone} and ${targetZone}.`,
      };
    }

    // Transfers to other zones require Standard Contractual Clauses (SCC) or explicit consent
    if (options?.hasStandardContractualClauses || options?.hasExplicitConsent) {
      return {
        allowed: true,
        sourceZone,
        targetZone,
        verdict: 'ALLOWED',
        reason: `Cross-border transfer from ${sourceZone} to ${targetZone} approved under Standard Contractual Clauses (SCC) and verified legal basis.`,
      };
    }

    return {
      allowed: false,
      sourceZone,
      targetZone,
      verdict: 'DENIED',
      reason: `Violation of ${sourceConfig.regulatoryFramework}: Destination zone ${targetZone} lacks an adequacy decision from ${sourceZone}. Requires Standard Contractual Clauses (SCC) or explicit consent.`,
    };
  }

  // 3. Explicit Consent / SCC Policy (Singapore PDPA 2012)
  if (sourceConfig.crossBorderTransferPolicy === 'explicit_consent_scc') {
    if (options?.hasExplicitConsent || options?.hasStandardContractualClauses) {
      return {
        allowed: true,
        sourceZone,
        targetZone,
        verdict: 'ALLOWED',
        reason: `Cross-border transfer from ${sourceZone} permitted under explicit subscriber consent or legally binding transfer agreement.`,
      };
    }

    return {
      allowed: false,
      sourceZone,
      targetZone,
      verdict: 'DENIED',
      reason: `Violation of ${sourceConfig.regulatoryFramework}: Cross-border transfer requires explicit consent or standard contractual clauses.`,
    };
  }

  // 4. Unrestricted Zones (US CCPA / GLOBAL)
  return {
    allowed: true,
    sourceZone,
    targetZone,
    verdict: 'ALLOWED',
    reason: `Transfer from ${sourceZone} permitted under standard cross-regional routing policy.`,
  };
}

/**
 * Returns the primary and fallback Cloudflare R2 / storage region bindings for a zone.
 */
export function getStorageRegionForZone(zoneCode: SovereignZoneCode): {
  primary: string;
  fallback: string | null;
} {
  const config = getZonePolicy(zoneCode);
  return {
    primary: config.primaryStorageRegion,
    fallback: config.fallbackStorageRegion,
  };
}

/**
 * Normalizes a raw database row into the strongly typed SovereignDataZone interface.
 */
export function mapRowToSovereignDataZone(row: Record<string, unknown>): SovereignDataZone {
  return {
    id: String(row.id),
    zoneCode: row.zone_code as SovereignZoneCode,
    name: String(row.name),
    jurisdictionLegalName: String(row.jurisdiction_legal_name),
    regulatoryFramework: row.regulatory_framework as RegulatoryFramework,
    primaryStorageRegion: String(row.primary_storage_region),
    fallbackStorageRegion: row.fallback_storage_region ? String(row.fallback_storage_region) : null,
    crossBorderTransferPolicy: row.cross_border_transfer_policy as CrossBorderTransferPolicy,
    mandatoryCmek: Boolean(row.mandatory_cmek),
    retentionPeriodDays: Number(row.retention_period_days || 2555),
    auditRetentionDays: Number(row.audit_retention_days || 2555),
    isActive: Boolean(row.is_active),
    createdAt: Number(row.created_at || Date.now()),
    updatedAt: Number(row.updated_at || Date.now()),
  };
}
