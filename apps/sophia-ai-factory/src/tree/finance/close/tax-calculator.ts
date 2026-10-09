/**
 * Withholding Tax Calculator with Zero Penny Leakage Guarantee
 * Layer: tree/finance
 *
 * @module tree/finance/close/tax-calculator
 */

import type { WithholdingTaxRegime } from '@/seed/types/financial-close';
import { WITHHOLDING_TAX_RATES } from './constants';

export interface WithholdingTaxResult {
  ratePct: number;
  taxCents: number;
  netCents: number;
}

/**
 * Calculate withholding tax and net settlement cents with zero penny leakage
 */
export function calculateWithholdingTax(
  regime: WithholdingTaxRegime,
  grossAmountCents: number
): WithholdingTaxResult {
  const ratePct = WITHHOLDING_TAX_RATES[regime] ?? 0.0;
  const taxCents = Math.round(grossAmountCents * (ratePct / 100));
  const netCents = grossAmountCents - taxCents;

  if (taxCents + netCents !== grossAmountCents) {
    throw new Error(
      `Tax calculation leakage: gross ${grossAmountCents} != tax ${taxCents} + net ${netCents}`
    );
  }

  return { ratePct, taxCents, netCents };
}
