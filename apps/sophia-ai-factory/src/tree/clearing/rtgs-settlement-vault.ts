/**
 * rtgs-settlement-vault.ts — Tree Layer Pure Domain Engine
 * Multilateral Real-Time Gross Settlement (RTGS) & Netting Engine
 */

import type {
  CentralBankClearingNode,
  FxCorridor,
} from '@/seed/types/central-bank-clearing';

export interface InterbankObligation {
  id: string;
  debtorBic: string;
  creditorBic: string;
  amountCents: number;
  currency: string;
}

export interface NettingResult {
  grossVolumeCents: number;
  netVolumeCents: number;
  compressionRatioPercentage: number;
  netPositions: Record<string, number>; // BIC -> net balance (positive = receives, negative = pays)
  settlementFeasible: boolean;
  unfundedBics: string[];
}

/**
 * Calculates multilateral netting for a set of interbank obligations
 */
export function calculateMultilateralNetting(
  obligations: InterbankObligation[],
  clearingNodes: Record<string, CentralBankClearingNode>,
): NettingResult {
  let grossVolumeCents = 0;
  const netPositions: Record<string, number> = {};

  for (const ob of obligations) {
    if (ob.amountCents <= 0) continue;
    grossVolumeCents += ob.amountCents;

    netPositions[ob.debtorBic] = (netPositions[ob.debtorBic] || 0) - ob.amountCents;
    netPositions[ob.creditorBic] = (netPositions[ob.creditorBic] || 0) + ob.amountCents;
  }

  let netVolumeCents = 0;
  const unfundedBics: string[] = [];

  for (const [bic, net] of Object.entries(netPositions)) {
    if (net < 0) {
      const paymentNeeded = Math.abs(net);
      netVolumeCents += paymentNeeded;

      const node = clearingNodes[bic];
      const availableFunds = node ? node.currentBalanceCents + node.creditLineCents : 0;
      if (availableFunds < paymentNeeded) {
        unfundedBics.push(bic);
      }
    }
  }

  const compressionRatioPercentage =
    grossVolumeCents > 0
      ? Math.round(((grossVolumeCents - netVolumeCents) / grossVolumeCents) * 10000) / 100
      : 0;

  return {
    grossVolumeCents,
    netVolumeCents,
    compressionRatioPercentage,
    netPositions,
    settlementFeasible: unfundedBics.length === 0,
    unfundedBics,
  };
}

/**
 * Executes currency corridor exchange rate conversion
 */
export function convertFxCorridor(
  amountCents: number,
  corridor: FxCorridor,
): { convertedCents: number; feeCents: number } {
  if (amountCents <= 0) {
    throw new Error('Amount must be positive');
  }
  if (!corridor.isActive) {
    throw new Error(`FX corridor ${corridor.baseCurrency}-${corridor.quoteCurrency} is inactive`);
  }

  const spreadFraction = corridor.spreadBps / 10_000;
  const grossConverted = (amountCents * corridor.exchangeRateMicros) / 1_000_000;
  const feeCents = Math.round(grossConverted * spreadFraction);
  const convertedCents = Math.round(grossConverted - feeCents);

  return {
    convertedCents,
    feeCents,
  };
}
