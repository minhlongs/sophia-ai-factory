/**
 * @file basel-xxxix-collateral-valuation.ts
 * @layer tree/reserve
 * @description Basel XXXIX Collateral Valuation Engine & Haircut Tables.
 */

import { calculateParameterizedCollateralValue } from './basel-solvency-domain-engine';
import type { QuinquagintamilliaquadrillionCollateralAssetType } from '@/seed/types/quinquagintamilliaquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface QuinquagintamilliaquadrillionCollateralValuationResult {
  assetType: QuinquagintamilliaquadrillionCollateralAssetType;
  nominalValueCents: number;
  haircutFactor: number;
  netValuationCents: number;
}

const QUINQUAGINTAMILLIAQUADRILLION_HAIRCUTS: Record<string, number> = {
  SOVEREIGN_BONDS: 1.000,
  PHYSICAL_GOLD: 1.010,
  SSDR_V29_BASKET: 1.015,
  TIER_1_EQUITIES: 1.050,
  QUINQUAGINTAMILLIAQUADRILLION_CREDITS: 1.025,
  QUINQUAGINTAMILLIAQUADRILLION_SUB_PLANCK_FOAM: 1.035,
};

/**
 * Calculates net collateral value applying Basel XXXIX asset haircut tables.
 */
export function calculateQuinquagintamilliaquadrillionCollateralValue(
  nominalValueCents: number,
  assetType: QuinquagintamilliaquadrillionCollateralAssetType
): QuinquagintamilliaquadrillionCollateralValuationResult {
  const result = calculateParameterizedCollateralValue(
    nominalValueCents,
    assetType,
    QUINQUAGINTAMILLIAQUADRILLION_HAIRCUTS,
    1.035
  );

  return {
    assetType,
    nominalValueCents: result.nominalValueCents,
    haircutFactor: result.haircutFactor,
    netValuationCents: result.netValuationCents,
  };
}
