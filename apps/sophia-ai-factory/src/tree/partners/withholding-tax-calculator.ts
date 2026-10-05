/**
 * Statutory Withholding Tax (WHT) & Foreign Contractor Tax (FCT) Calculator
 *
 * Implements genuine cross-border tax withholding calculations for:
 * 1. Vietnam FCT (Circular 103/2014/TT-BTC 10% corporate vs Circular 111/2013/TT-BTC 5% individual)
 * 2. US IRS W-8BEN (30% statutory rate vs 0% - 15% Bilateral Double Taxation Treaty rates)
 * 3. European Union B2B Reverse Charge (0% WHT with valid VAT ID)
 * 4. Singapore IRAS Section 45 Non-Resident Withholding (15% service fee)
 * 5. Standard Zero / Domestic Jurisdiction (0% WHT)
 *
 * Layer: tree (pure domain logic, zero side-effects, no upper-layer imports)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/withholding-tax-calculator
 */

import type {
  WithholdingJurisdiction,
  TaxCertificateStatus,
  TaxCalculationResult,
} from '@/seed/types/cross-border-ledger';

/**
 * Input arguments for calculating withholding tax.
 */
export interface CalculateWithholdingTaxInput {
  grossCents: number;
  jurisdiction: WithholdingJurisdiction;
  isIndividual?: boolean;
  certificateStatus?: TaxCertificateStatus;
  customTreatyRatePct?: number;
  taxIdNumber?: string | null;
}

interface TaxJurisdictionRate {
  ratePct: number;
  treatyApplied: boolean;
  complianceNote: string;
}

function resolveVnFctRate(
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
    // Circular 111/2013/TT-BTC: 5% Personal Income Tax on commission/service income
    return {
      ratePct: 5.0,
      treatyApplied: false,
      complianceNote: 'Vietnam FCT: 5% Individual Withholding Tax pursuant to Circular 111/2013/TT-BTC',
    };
  }
  // Circular 103/2014/TT-BTC: 5% VAT + 5% CIT = 10% Corporate Foreign Contractor Tax
  return {
    ratePct: 10.0,
    treatyApplied: false,
    complianceNote: 'Vietnam FCT: 10% Corporate Foreign Contractor Tax pursuant to Circular 103/2014/TT-BTC (5% CIT + 5% VAT)',
  };
}

function resolveUsW8Rate(
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
    // Verified W-8BEN or W-8BEN-E: Apply Bilateral Tax Treaty rate (0% to 15%)
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
  // Pending or rejected: Fallback to statutory 30% withholding (IRC Section 1441/1442)
  return {
    ratePct: 30.0,
    treatyApplied: false,
    complianceNote: 'US W-8: 30% Statutory Withholding Rate applied (W-8 verification pending or rejected)',
  };
}

function resolveSgNrRate(certificateStatus: TaxCertificateStatus): TaxJurisdictionRate {
  if (certificateStatus === 'exempt') {
    return {
      ratePct: 0,
      treatyApplied: true,
      complianceNote: 'Singapore: Exempt under approved IRAS Tax Exemption Certificate',
    };
  }
  // Singapore Section 45: 15% Withholding Tax on Non-Resident service & agency fees
  return {
    ratePct: 15.0,
    treatyApplied: false,
    complianceNote: 'Singapore IRAS Section 45: 15% Non-Resident Withholding Tax on agency & service fees',
  };
}

function resolveJurisdictionRate(input: CalculateWithholdingTaxInput): TaxJurisdictionRate {
  const certificateStatus: TaxCertificateStatus = input.certificateStatus ?? 'pending';

  switch (input.jurisdiction) {
    case 'VN_FCT':
      return resolveVnFctRate(input.isIndividual, certificateStatus);
    case 'US_W8':
      return resolveUsW8Rate(certificateStatus, input.customTreatyRatePct);
    case 'EU_RC':
      // EU B2B Reverse Charge under Article 196 VAT Directive 2006/112/EC
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

/**
 * Calculate statutory withholding tax for cross-border affiliate & reseller commission payouts.
 * Performs exact integer cents arithmetic with zero floating-point drift.
 */
export function calculateWithholdingTax(
  input: CalculateWithholdingTaxInput,
): TaxCalculationResult {
  const grossCents = Math.max(0, Math.floor(input.grossCents));
  const certificateStatus: TaxCertificateStatus = input.certificateStatus ?? 'pending';

  const { ratePct, treatyApplied, complianceNote } = resolveJurisdictionRate(input);

  // Calculate integer cents
  const withholdingCents = Math.min(
    grossCents,
    Math.round((grossCents * ratePct) / 100),
  );
  const netCents = Math.max(0, grossCents - withholdingCents);

  return {
    grossCents,
    jurisdiction: input.jurisdiction,
    ratePct,
    withholdingCents,
    netCents,
    treatyApplied,
    certificateStatus,
    complianceNote,
  };
}
