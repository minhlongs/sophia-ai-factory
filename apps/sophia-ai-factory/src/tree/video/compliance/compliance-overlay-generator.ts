/**
 * Compliance Overlay Generator.
 * Generates jurisdiction-tailored regulatory disclaimer overlays for short video rendering.
 */

import {
  CRYPTO_DISCLAIMER_REGISTRY,
  type CryptoJurisdiction,
} from '@/seed/config/crypto-disclaimer-registry';
import type {
  ComplianceOverlayInput,
  ComplianceOverlaySpec,
} from './compliance-types';
import { evaluateJurisdictionCompliance } from './jurisdiction-compliance-guard';

export function generateComplianceOverlay(
  input: ComplianceOverlayInput
): ComplianceOverlaySpec {
  const {
    niche,
    hasFinancialClaim,
    hasAffiliateLink,
    targetJurisdiction = 'GLOBAL',
  } = input;

  const guard = evaluateJurisdictionCompliance(niche, targetJurisdiction);

  // Default FTC disclosure for affiliate promotions
  const ftcBadgeText = hasAffiliateLink ? '#ad #affiliate' : '';

  if (niche === 'saas_global') {
    return {
      niche,
      jurisdiction: guard.jurisdiction,
      isAllowed: guard.isAllowed,
      disclaimerText: 'Sponsored content. Results may vary based on user implementation.',
      ftcBadgeText,
      regulatoryRef: 'FTC 16 CFR Part 255',
      position: 'bottom_bar',
      opacity: 0.85,
      fontSizePx: 24,
      displayStartSecond: 0,
      displayDurationSecond: 999, // Persistent overlay
    };
  }

  // Crypto Niche Disclaimers
  const jurKey = (guard.jurisdiction in CRYPTO_DISCLAIMER_REGISTRY
    ? guard.jurisdiction
    : 'US') as CryptoJurisdiction;

  const disclaimerData = CRYPTO_DISCLAIMER_REGISTRY[jurKey];

  return {
    niche,
    jurisdiction: guard.jurisdiction,
    isAllowed: guard.isAllowed,
    disclaimerText: disclaimerData.full.en,
    subDisclaimerText: hasFinancialClaim
      ? 'Not financial advice (NFA). Past performance does not guarantee future results.'
      : undefined,
    ftcBadgeText: `${ftcBadgeText} #crypto #nfa`,
    regulatoryRef: guard.regulatoryRef || disclaimerData.regulatoryRef,
    position: 'bottom_bar',
    opacity: 0.9,
    fontSizePx: 26,
    displayStartSecond: 0,
    displayDurationSecond: 999,
  };
}
