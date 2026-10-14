import type { CollateralValuationResult } from './types';

/**
 * Calculates net haircut-adjusted collateral value.
 */
export function calculateParameterizedCollateralValue(
  pledgedAmountCents: number,
  assetType: string,
  haircuts: Record<string, number>,
  defaultHaircut: number = 1.5
): CollateralValuationResult {
  const factor = haircuts[assetType] ?? defaultHaircut;
  let netValuationCents: number;

  if (pledgedAmountCents > 1e14) {
    const factorScaled = BigInt(Math.round(factor * 10000));
    const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
    netValuationCents = Number(pledgedScaled / factorScaled);
  } else {
    netValuationCents = Math.floor(pledgedAmountCents / factor);
  }

  return {
    assetType,
    nominalValueCents: pledgedAmountCents,
    haircutFactor: factor,
    haircutMultiplier: factor,
    netValuationCents,
  };
}
