/**
 * Jurisdiction Compliance Guard
 *
 * Validates target country compliance and enforces geo-fencing for Crypto & SaaS campaigns.
 * Fail-closed on unassessed or blocked jurisdictions for regulated crypto niches.
 * Layer: tree (domain compliance logic)
 * @module tree/video/compliance/jurisdiction-compliance-guard
 */

import {
  CRYPTO_DISCLAIMER_REGISTRY,
} from '@/seed/config/crypto-disclaimer-registry';
import type { VideoNiche } from '@/seed/config/video-blueprints/blueprint-types';
import {
  EU_MICA_DISCLAIMERS,
  FTC_ONLY_DISCLAIMERS,
  GLOBAL_DEFAULT_DISCLAIMERS,
  JP_FSA_DISCLAIMERS,
  US_CRYPTO_DISCLAIMERS,
} from './jurisdiction-disclaimer-presets';

export interface ComplianceGuardResult {
  isAllowed: boolean;
  jurisdiction: string;
  niche: VideoNiche;
  reason?: string;
  regulatoryRef?: string;
  requiredDisclaimers: {
    requiresFtcDisclosure: boolean;
    requiresCftcDisclaimer: boolean;
    requiresMicaNotice: boolean;
    requiresPersistentBanner: boolean;
    requiresEndCard15s: boolean;
    paidPartnershipTag: boolean;
  };
}

export function evaluateJurisdictionCompliance(
  niche: VideoNiche,
  rawJurisdiction: string = 'GLOBAL',
): ComplianceGuardResult {
  const normalized = rawJurisdiction.trim().toUpperCase();

  // 1. SaaS Global Niche Compliance: Universal FTC / Ad Disclosure
  if (niche === 'saas_global') {
    return {
      isAllowed: true,
      jurisdiction: normalized || 'GLOBAL',
      niche,
      requiredDisclaimers: { ...FTC_ONLY_DISCLAIMERS },
    };
  }

  // 2. Crypto Global Niche Compliance: Hard Geo-Fencing Checks
  if (normalized === 'VN') {
    return {
      isAllowed: false,
      jurisdiction: 'VN',
      niche,
      reason: 'VIETNAM_PROMOTIONAL_BAN',
      regulatoryRef: CRYPTO_DISCLAIMER_REGISTRY.VN.regulatoryRef,
      requiredDisclaimers: { ...FTC_ONLY_DISCLAIMERS },
    };
  }

  if (normalized === 'SG') {
    return {
      isAllowed: false,
      jurisdiction: 'SG',
      niche,
      reason: 'SINGAPORE_MAS_PSN08_RETAIL_BAN',
      regulatoryRef: CRYPTO_DISCLAIMER_REGISTRY.SG.regulatoryRef,
      requiredDisclaimers: { ...FTC_ONLY_DISCLAIMERS },
    };
  }

  // 3. United States Strict Crypto Rules (FTC + CFTC Rule 4.41)
  if (normalized === 'US') {
    return {
      isAllowed: true,
      jurisdiction: 'US',
      niche,
      regulatoryRef: 'FTC 16 C.F.R. § 255.5 / CFTC Rule 4.41',
      requiredDisclaimers: { ...US_CRYPTO_DISCLAIMERS },
    };
  }

  // 4. European Union MiCA Rules (Regulation EU 2023/1114 Art. 7 & 53)
  if (normalized === 'EU') {
    return {
      isAllowed: true,
      jurisdiction: 'EU',
      niche,
      regulatoryRef: 'EU MiCA Regulation (EU 2023/1114) Art. 7 & 53',
      requiredDisclaimers: { ...EU_MICA_DISCLAIMERS },
    };
  }

  // 5. Japan FSA Rules (Payment Services Act / FIEA registered crypto exchange)
  if (normalized === 'JP') {
    return {
      isAllowed: true,
      jurisdiction: 'JP',
      niche,
      regulatoryRef: CRYPTO_DISCLAIMER_REGISTRY.JP.regulatoryRef,
      requiredDisclaimers: { ...JP_FSA_DISCLAIMERS },
    };
  }

  // 6. Fail-closed on GLOBAL, unknown, empty, or unassessed jurisdictions for regulated crypto.
  // GLOBAL is never an assessed crypto jurisdiction — regulated financial promotions require
  // an explicit assessed market (US, EU, JP) before publication.
  return {
    isAllowed: false,
    jurisdiction: normalized || 'UNKNOWN',
    niche,
    reason: 'JURISDICTION_UNASSESSED_OR_BLOCKED',
    regulatoryRef: 'Fail-Closed Regulated Crypto Policy (Unassessed Jurisdiction)',
    requiredDisclaimers: { ...GLOBAL_DEFAULT_DISCLAIMERS },
  };
}
