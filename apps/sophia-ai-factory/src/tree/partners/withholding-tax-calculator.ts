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
import { resolveJurisdictionRate } from './withholding-jurisdiction-rates';

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
