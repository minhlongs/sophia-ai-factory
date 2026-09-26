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

/**
 * Calculate statutory withholding tax for cross-border affiliate & reseller commission payouts.
 * Performs exact integer cents arithmetic with zero floating-point drift.
 */
export function calculateWithholdingTax(
  input: CalculateWithholdingTaxInput,
): TaxCalculationResult {
  const grossCents = Math.max(0, Math.floor(input.grossCents));
  const certificateStatus: TaxCertificateStatus = input.certificateStatus ?? 'pending';

  let ratePct = 0;
  let treatyApplied = false;
  let complianceNote = '';

  switch (input.jurisdiction) {
    case 'VN_FCT': {
      if (certificateStatus === 'exempt') {
        ratePct = 0;
        treatyApplied = true;
        complianceNote = 'Vietnam FCT: Exempt pursuant to approved Tax Exemption Certificate';
      } else if (input.isIndividual) {
        // Circular 111/2013/TT-BTC: 5% Personal Income Tax on commission/service income
        ratePct = 5.0;
        treatyApplied = false;
        complianceNote = 'Vietnam FCT: 5% Individual Withholding Tax pursuant to Circular 111/2013/TT-BTC';
      } else {
        // Circular 103/2014/TT-BTC: 5% VAT + 5% CIT = 10% Corporate Foreign Contractor Tax
        ratePct = 10.0;
        treatyApplied = false;
        complianceNote = 'Vietnam FCT: 10% Corporate Foreign Contractor Tax pursuant to Circular 103/2014/TT-BTC (5% CIT + 5% VAT)';
      }
      break;
    }

    case 'US_W8': {
      if (certificateStatus === 'exempt') {
        ratePct = 0;
        treatyApplied = true;
        complianceNote = 'US W-8: 0% Withholding pursuant to verified IRS tax exemption';
      } else if (certificateStatus === 'verified') {
        // Verified W-8BEN or W-8BEN-E: Apply Bilateral Tax Treaty rate (0% to 15%)
        treatyApplied = true;
        if (typeof input.customTreatyRatePct === 'number' && !isNaN(input.customTreatyRatePct)) {
          ratePct = Math.max(0, Math.min(30.0, input.customTreatyRatePct));
        } else {
          // Standard treaty rate for intellectual property / SaaS commission is 10%
          ratePct = 10.0;
        }
        complianceNote = `US W-8BEN: ${ratePct}% Bilateral Double Taxation Treaty rate applied (Form W-8 verified)`;
      } else {
        // Pending or rejected: Fallback to statutory 30% withholding (IRC Section 1441/1442)
        ratePct = 30.0;
        treatyApplied = false;
        complianceNote = 'US W-8: 30% Statutory Withholding Rate applied (W-8 verification pending or rejected)';
      }
      break;
    }

    case 'EU_RC': {
      // EU B2B Reverse Charge under Article 196 VAT Directive 2006/112/EC
      ratePct = 0.0;
      treatyApplied = true;
      complianceNote = 'EU B2B Reverse Charge: 0% Withholding pursuant to Article 196 VAT Directive 2006/112/EC';
      break;
    }

    case 'SG_NR': {
      if (certificateStatus === 'exempt') {
        ratePct = 0;
        treatyApplied = true;
        complianceNote = 'Singapore: Exempt under approved IRAS Tax Exemption Certificate';
      } else {
        // Singapore Section 45: 15% Withholding Tax on Non-Resident service & agency fees
        ratePct = 15.0;
        treatyApplied = false;
        complianceNote = 'Singapore IRAS Section 45: 15% Non-Resident Withholding Tax on agency & service fees';
      }
      break;
    }

    case 'STANDARD_ZERO':
    default: {
      ratePct = 0.0;
      treatyApplied = false;
      complianceNote = 'Standard Domestic / Zero Withholding Tax Jurisdiction';
      break;
    }
  }

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
