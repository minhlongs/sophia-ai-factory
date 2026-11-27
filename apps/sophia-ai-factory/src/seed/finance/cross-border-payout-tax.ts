/**
 * Cross-Border Affiliate Payout Reconciliation & Withholding-Tax Calculator.
 *
 * Clean-room pure-TS BigInt engine (Apache-2.0/MIT patterns from tigerbeetle,
 * blnkfinance/blnk, and invopop/gobl):
 * - Computes exact integer-unit withholding tax (basis points) and net payout
 *   for USDT/USDC (NOWPayments), VND (PayOS), and USD wire with zero float drift.
 *
 * Layer: seed/finance (pure BigInt math, zero external deps)
 *
 * @module seed/finance/cross-border-payout-tax
 */

export type PayoutRail = 'NOWPAYMENTS_USDT' | 'PAYOS_VND' | 'USD_WIRE';

export interface PayoutTaxInput {
  readonly grossMinorUnits: bigint;
  readonly withholdingTaxBps: number; // e.g. 1000 = 10% PIT
  readonly rail: PayoutRail;
}

export interface PayoutTaxBreakdown {
  readonly rail: PayoutRail;
  readonly grossMinorUnits: bigint;
  readonly taxWithheldMinorUnits: bigint;
  readonly netPayoutMinorUnits: bigint;
  readonly balanced: boolean;
}

export function computeCrossBorderPayoutTax(input: PayoutTaxInput): PayoutTaxBreakdown {
  if (input.grossMinorUnits < 0n) {
    throw new Error('grossMinorUnits must be non-negative');
  }
  if (!Number.isFinite(input.withholdingTaxBps)) {
    throw new Error('withholdingTaxBps must be a finite number');
  }
  const safeBps = Math.max(0, Math.min(5000, Math.round(input.withholdingTaxBps)));
  // Half-up integer rounding for tax withholding
  const taxWithheldMinorUnits = (input.grossMinorUnits * BigInt(safeBps) + 5000n) / 10_000n;
  const netPayoutMinorUnits = input.grossMinorUnits - taxWithheldMinorUnits;

  return {
    rail: input.rail,
    grossMinorUnits: input.grossMinorUnits,
    taxWithheldMinorUnits,
    netPayoutMinorUnits,
    balanced: taxWithheldMinorUnits + netPayoutMinorUnits === input.grossMinorUnits,
  };
}
