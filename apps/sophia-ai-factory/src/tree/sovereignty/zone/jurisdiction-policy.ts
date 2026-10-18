import type {
  SovereignZoneCode,
  CrossBorderValidationResult,
} from '@/seed/types/sovereign-vault';
import { SOVEREIGN_ZONE_CONFIGS, type SovereignZoneConfig } from './types';

export {
  getStorageRegionForZone,
  mapRowToSovereignDataZone,
} from './sovereign-zone-mapper';

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
