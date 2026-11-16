/**
 * Jurisdiction Compliance Disclaimer Matrix Presets
 *
 * Layer: tree/video/compliance
 * @module tree/video/compliance/jurisdiction-disclaimer-presets
 */

import type { ComplianceGuardResult } from './jurisdiction-compliance-guard';

export type RequiredDisclaimerFlags = ComplianceGuardResult['requiredDisclaimers'];

export const FTC_ONLY_DISCLAIMERS: RequiredDisclaimerFlags = {
  requiresFtcDisclosure: true,
  requiresCftcDisclaimer: false,
  requiresMicaNotice: false,
  requiresPersistentBanner: false,
  requiresEndCard15s: false,
  paidPartnershipTag: true,
};

export const US_CRYPTO_DISCLAIMERS: RequiredDisclaimerFlags = {
  requiresFtcDisclosure: true,
  requiresCftcDisclaimer: true,
  requiresMicaNotice: false,
  requiresPersistentBanner: true,
  requiresEndCard15s: true,
  paidPartnershipTag: true,
};

export const EU_MICA_DISCLAIMERS: RequiredDisclaimerFlags = {
  requiresFtcDisclosure: true,
  requiresCftcDisclaimer: false,
  requiresMicaNotice: true,
  requiresPersistentBanner: true,
  requiresEndCard15s: true,
  paidPartnershipTag: true,
};

export const JP_FSA_DISCLAIMERS: RequiredDisclaimerFlags = {
  requiresFtcDisclosure: true,
  requiresCftcDisclaimer: false,
  requiresMicaNotice: false,
  requiresPersistentBanner: true,
  requiresEndCard15s: true,
  paidPartnershipTag: true,
};

export const GLOBAL_DEFAULT_DISCLAIMERS: RequiredDisclaimerFlags = {
  requiresFtcDisclosure: true,
  requiresCftcDisclaimer: true,
  requiresMicaNotice: true,
  requiresPersistentBanner: true,
  requiresEndCard15s: true,
  paidPartnershipTag: true,
};
