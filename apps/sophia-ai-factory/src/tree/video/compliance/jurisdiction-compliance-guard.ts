/**
 * Jurisdiction Compliance Guard
 *
 * Validates target country compliance and enforces geo-fencing for Crypto & SaaS campaigns.
 * Layer: tree (domain compliance logic)
 * @module tree/video/compliance/jurisdiction-compliance-guard
 */

import {
  CRYPTO_DISCLAIMER_REGISTRY,
} from '@/seed/config/crypto-disclaimer-registry';
import type { VideoNiche } from '@/seed/config/video-blueprints/blueprint-types';

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
      jurisdiction: normalized,
      niche,
      requiredDisclaimers: {
        requiresFtcDisclosure: true,
        requiresCftcDisclaimer: false,
        requiresMicaNotice: false,
        requiresPersistentBanner: false,
        requiresEndCard15s: false,
        paidPartnershipTag: true,
      },
    };
  }

  // 2. Crypto Global Niche Compliance: Hard Geo-Fencing Checks
  if (normalized === 'VN') {
    const vnConfig = CRYPTO_DISCLAIMER_REGISTRY.VN;
    return {
      isAllowed: false,
      jurisdiction: 'VN',
      niche,
      reason: 'VIETNAM_PROMOTIONAL_BAN',
      regulatoryRef: vnConfig.regulatoryRef,
      requiredDisclaimers: {
        requiresFtcDisclosure: true,
        requiresCftcDisclaimer: false,
        requiresMicaNotice: false,
        requiresPersistentBanner: false,
        requiresEndCard15s: false,
        paidPartnershipTag: true,
      },
    };
  }

  if (normalized === 'SG') {
    const sgConfig = CRYPTO_DISCLAIMER_REGISTRY.SG;
    return {
      isAllowed: false,
      jurisdiction: 'SG',
      niche,
      reason: 'SINGAPORE_MAS_PSN08_RETAIL_BAN',
      regulatoryRef: sgConfig.regulatoryRef,
      requiredDisclaimers: {
        requiresFtcDisclosure: true,
        requiresCftcDisclaimer: false,
        requiresMicaNotice: false,
        requiresPersistentBanner: false,
        requiresEndCard15s: false,
        paidPartnershipTag: true,
      },
    };
  }

  // 3. United States Strict Crypto Rules (FTC + CFTC Rule 4.41)
  if (normalized === 'US') {
    return {
      isAllowed: true,
      jurisdiction: 'US',
      niche,
      regulatoryRef: 'FTC 16 C.F.R. § 255.5 / CFTC Rule 4.41',
      requiredDisclaimers: {
        requiresFtcDisclosure: true,
        requiresCftcDisclaimer: true,
        requiresMicaNotice: false,
        requiresPersistentBanner: true,
        requiresEndCard15s: true,
        paidPartnershipTag: true,
      },
    };
  }

  // 4. European Union MiCA Rules (Regulation EU 2023/1114 Art. 7 & 53)
  if (normalized === 'EU') {
    return {
      isAllowed: true,
      jurisdiction: 'EU',
      niche,
      regulatoryRef: 'EU MiCA Regulation (EU 2023/1114) Art. 7 & 53',
      requiredDisclaimers: {
        requiresFtcDisclosure: true,
        requiresCftcDisclaimer: false,
        requiresMicaNotice: true,
        requiresPersistentBanner: true,
        requiresEndCard15s: true,
        paidPartnershipTag: true,
      },
    };
  }

  // 5. Default Global Compliance Standard
  return {
    isAllowed: true,
    jurisdiction: normalized,
    niche,
    regulatoryRef: 'Global Standard (FTC Endorsement Guide)',
    requiredDisclaimers: {
      requiresFtcDisclosure: true,
      requiresCftcDisclaimer: true,
      requiresMicaNotice: true,
      requiresPersistentBanner: true,
      requiresEndCard15s: true,
      paidPartnershipTag: true,
    },
  };
}
