/**
 * Statutory Contractor Tax Withholding Calculator.
 *
 * Implements statutory tax withholding across VN TT111/TT78, US W-8BEN, TH WHT, EU Reverse Charge.
 *
 * Invariant: taxWithheldCents + netPayableCents === grossCents
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/tax-calculator
 */

import {
  STATUTORY_TAX_RATES,
  type ContractorTaxRegime,
  type TaxWithholdingResult,
} from '@/seed/types/creator-dao-c2pa';

/**
 * Calculates statutory contractor tax withholding.
 *
 * Invariant: taxWithheldCents + netPayableCents === grossCents
 */
export function calculateTaxWithholding(
  grossCents: number,
  regime: ContractorTaxRegime,
  customRatePct?: number,
): TaxWithholdingResult {
  if (grossCents < 0 || !Number.isInteger(grossCents)) {
    throw new Error(
      `grossCents must be a non-negative integer, got: ${grossCents}`,
    );
  }

  const taxRatePct =
    customRatePct !== undefined
      ? customRatePct
      : (STATUTORY_TAX_RATES[regime] ?? 0.0);
  const taxWithheldCents = Math.floor((grossCents * taxRatePct) / 100);
  const netPayableCents = grossCents - taxWithheldCents;

  const invarianceVerified = taxWithheldCents + netPayableCents === grossCents;

  return {
    grossCents,
    taxRegime: regime,
    taxRatePct,
    taxWithheldCents,
    netPayableCents,
    invarianceVerified,
  };
}
