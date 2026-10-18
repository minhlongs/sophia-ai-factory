/**
 * Jurisdiction-specific rate resolvers for Statutory Withholding Tax (WHT) & FCT.
 *
 * Layer: tree/partners
 */

import type {
  WithholdingJurisdiction,
  TaxCertificateStatus,
} from '@/seed/types/cross-border-ledger';

export interface TaxJurisdictionRate {
  ratePct: number;
  treatyApplied: boolean;
  complianceNote: string;
}

export interface JurisdictionRateLookupInput {
  jurisdiction: WithholdingJurisdiction;
  isIndividual?: boolean;
  certificateStatus?: TaxCertificateStatus;
  customTreatyRatePct?: number;
}

export function resolveVnFctRate(
  isIndividual: boolean | undefined,
  certificateStatus: TaxCertificateStatus,
): TaxJurisdictionRate {
  if (certificateStatus === 'exempt') {
    return {
      ratePct: 0,
      treatyApplied: true,
      complianceNote: 'Vietnam FCT: Exempt pursuant to approved Tax Exemption Certificate',
    };
  }
  if (isIndividual) {
    return {
      ratePct: 5.0,
      treatyApplied: false,
      complianceNote: 'Vietnam FCT: 5% Individual Withholding Tax pursuant to Circular 111/2013/TT-BTC',
    };
  }
  return {
    ratePct: 10.0,
    treatyApplied: false,
    complianceNote: 'Vietnam FCT: 10% Corporate Foreign Contractor Tax pursuant to Circular 103/2014/TT-BTC (5% CIT + 5% VAT)',
  };
}

export function resolveUsW8Rate(
  certificateStatus: TaxCertificateStatus,
  customTreatyRatePct?: number,
): TaxJurisdictionRate {
  if (certificateStatus === 'exempt') {
    return {
      ratePct: 0,
      treatyApplied: true,
      complianceNote: 'US W-8: 0% Withholding pursuant to verified IRS tax exemption',
    };
  }
  if (certificateStatus === 'verified') {
    const ratePct =
      typeof customTreatyRatePct === 'number' && !isNaN(customTreatyRatePct)
        ? Math.max(0, Math.min(30.0, customTreatyRatePct))
        : 10.0;
    return {
      ratePct,
      treatyApplied: true,
      complianceNote: `US W-8BEN: ${ratePct}% Bilateral Double Taxation Treaty rate applied (Form W-8 verified)`,
    };
  }
  return {
    ratePct: 30.0,
    treatyApplied: false,
    complianceNote: 'US W-8: 30% Statutory Withholding Rate applied (W-8 verification pending or rejected)',
  };
}

export function resolveSgNrRate(certificateStatus: TaxCertificateStatus): TaxJurisdictionRate {
  if (certificateStatus === 'exempt') {
    return {
      ratePct: 0,
      treatyApplied: true,
      complianceNote: 'Singapore: Exempt under approved IRAS Tax Exemption Certificate',
    };
  }
  return {
    ratePct: 15.0,
    treatyApplied: false,
    complianceNote: 'Singapore IRAS Section 45: 15% Non-Resident Withholding Tax on agency & service fees',
  };
}

export function resolveJurisdictionRate(input: JurisdictionRateLookupInput): TaxJurisdictionRate {
  const certificateStatus: TaxCertificateStatus = input.certificateStatus ?? 'pending';

  switch (input.jurisdiction) {
    case 'VN_FCT':
      return resolveVnFctRate(input.isIndividual, certificateStatus);
    case 'US_W8':
      return resolveUsW8Rate(certificateStatus, input.customTreatyRatePct);
    case 'EU_RC':
      return {
        ratePct: 0.0,
        treatyApplied: true,
        complianceNote: 'EU B2B Reverse Charge: 0% Withholding pursuant to Article 196 VAT Directive 2006/112/EC',
      };
    case 'SG_NR':
      return resolveSgNrRate(certificateStatus);
    case 'STANDARD_ZERO':
    default:
      return {
        ratePct: 0.0,
        treatyApplied: false,
        complianceNote: 'Standard Domestic / Zero Withholding Tax Jurisdiction',
      };
  }
}
