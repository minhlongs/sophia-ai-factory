import {
  type TaxCalculationResult,
  type CrossBorderPayoutCalculation,
  DEFAULT_HEDGING_BUFFER_PCT,
  isZeroDecimalCurrency,
} from '@/seed/types/cross-border-ledger';
import { calculateWithholdingTax } from '../withholding-tax-calculator';
import { BEDROCK_LEDGER_FX_RATES } from './constants';
import type { CalculateCrossBorderPayoutInput } from './types';

/**
 * Pure domain calculation of withholding tax and hedged local currency payout.
 *
 * Mathematical Formula:
 * 1. Gross USD Cents -> WHT Cents (calculated via jurisdiction rules) -> Net USD Cents
 * 2. Effective FX Rate = Base FX Rate * (1 - hedgingBufferPct / 100)
 * 3. Local Payout Amount:
 *    - For Zero-Decimal Currencies (VND, JPY): floor((Net USD Cents / 100) * Effective FX Rate)
 *    - For Decimal Currencies (EUR, GBP, SGD, etc.): floor(Net USD Cents * Effective FX Rate) [in minor units / cents]
 */
export function calculateCrossBorderPayout(
  input: CalculateCrossBorderPayoutInput,
): {
  tax: TaxCalculationResult;
  payout: CrossBorderPayoutCalculation;
} {
  // 1. Calculate Withholding Tax
  const tax = calculateWithholdingTax({
    grossCents: input.grossCents,
    jurisdiction: input.jurisdiction,
    isIndividual: input.isIndividual,
    certificateStatus: input.certificateStatus,
    customTreatyRatePct: input.customTreatyRatePct,
    taxIdNumber: input.taxIdNumber,
  });

  // 2. Resolve FX Rate & Buffer
  const targetCurrency = input.targetCurrency;
  const baseFxRate = input.baseFxRate && input.baseFxRate > 0
    ? input.baseFxRate
    : (BEDROCK_LEDGER_FX_RATES[targetCurrency] ?? 1.0);

  const hedgingBufferPct = typeof input.hedgingBufferPct === 'number' && input.hedgingBufferPct >= 0
    ? input.hedgingBufferPct
    : DEFAULT_HEDGING_BUFFER_PCT;

  // Protect against slippage: effective rate discounted by buffer percentage
  const bufferMultiplier = Math.max(0, 1.0 - hedgingBufferPct / 100.0);
  const effectiveFxRate = baseFxRate * bufferMultiplier;

  // 3. Compute Local Payout Amount
  const zeroDecimal = isZeroDecimalCurrency(targetCurrency);
  let localPayoutAmount = 0;

  if (zeroDecimal) {
    // Integer units (e.g. whole VND or JPY)
    const netUsdDollars = tax.netCents / 100.0;
    localPayoutAmount = Math.max(0, Math.floor(netUsdDollars * effectiveFxRate));
  } else {
    // Minor units (cents/pence)
    localPayoutAmount = Math.max(0, Math.floor(tax.netCents * effectiveFxRate));
  }

  const payout: CrossBorderPayoutCalculation = {
    grossCents: tax.grossCents,
    withholdingCents: tax.withholdingCents,
    netCents: tax.netCents,
    targetCurrency,
    baseFxRate,
    hedgingBufferPct,
    effectiveFxRate,
    localPayoutAmount,
    isZeroDecimalCurrency: zeroDecimal,
  };

  return { tax, payout };
}
