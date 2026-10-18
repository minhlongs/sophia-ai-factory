/**
 * @file basel-xli-collateral-valuation.ts
 * @layer tree/reserve
 * @description Basel XLI Ducenti-Quinquaginta-Quintillion Collateral Haircut Table and Valuation Engine.
 */

import type { DucentiquinquagintaquintillionCollateralAssetType } from '@/seed/types/ducenti-quinquaginta-quintillion-trans-cosmic-hyper-rtgs-capital';

export interface DucentiquinquagintaquintillionCollateralValuationResult {
  assetType: DucentiquinquagintaquintillionCollateralAssetType;
  nominalValueCents: number;
  haircutMultiplier: number;
  netValuationCents: number;
}

/**
 * Haircut table for Ducenti-Quinquaginta-Quintillion high-tier sovereign collateral assets under Basel XLI.
 */
export const DUCENTIQUINQUAGINTAQUINTILLION_COLLATERAL_HAIRCUTS: Record<
  DucentiquinquagintaquintillionCollateralAssetType,
  number
> = {
  SOVEREIGN_BONDS: 1.0,
  PHYSICAL_GOLD: 1.005,
  SSDR_V30_BASKET: 1.01,
  TIER_1_EQUITIES: 1.02,
  DUCENTIQUINQUAGINTAQUINTILLION_CREDITS: 1.025,
  DUCENTIQUINQUAGINTAQUINTILLION_SUB_PLANCK_FOAM: 1.03,
};

/**
 * Valuates collateral assets with Basel XLI regulatory haircuts.
 */
export function valuateDucentiquinquagintaquintillionCollateral(
  first: DucentiquinquagintaquintillionCollateralAssetType | number,
  second: number | DucentiquinquagintaquintillionCollateralAssetType
): DucentiquinquagintaquintillionCollateralValuationResult {
  const assetType =
    typeof first === 'string'
      ? first
      : (second as DucentiquinquagintaquintillionCollateralAssetType);
  const nominalValueCents = typeof first === 'number' ? first : (second as number);
  const haircutMultiplier =
    DUCENTIQUINQUAGINTAQUINTILLION_COLLATERAL_HAIRCUTS[assetType] ?? 1.005;
  const netValuationCents = Math.round(nominalValueCents * haircutMultiplier);
  return {
    assetType,
    nominalValueCents,
    haircutMultiplier,
    netValuationCents,
  };
}
