/**
 * @file basel-x-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel X Pan-Cosmic Solvency & $100.0B Sovereign Reserve Grid.
 */

import { calculateParameterizedCollateralValue } from './basel-solvency-domain-engine';
import { evaluateBaselXToXviiSolvency } from './basel-x-to-xvii-solvency-helper';
import {
  GATE_20_SCALE_TARGETS,
  type BaselXSolvencyStatus,
  type PanCosmicCollateralAsset,
} from '@/seed/types/trans-omniverse-rtgs-capital';

export interface BaselXSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const PAN_COSMIC_COLLATERAL_HAIRCUTS: Record<PanCosmicCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V2_BASKET: 1.10,
  TIER_1_EQUITIES: 1.20,
  PAN_COSMIC_CREDITS: 1.30,
  ZERO_POINT_SINGULARITIES: 1.40,
};

export function calculatePanCosmicCollateralValue(
  pledgedAmountCents: number,
  assetType: PanCosmicCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    PAN_COSMIC_COLLATERAL_HAIRCUTS,
    1.5
  );
}

export function evaluateBaselXSolvency(input: BaselXSolvencyInput): BaselXSolvencyOutput {
  return evaluateBaselXToXviiSolvency<BaselXSolvencyStatus>(input, {
    tierLabel: 'Basel X',
    auditPrefix: 'BASEL_X_AUDIT',
    minCet1Bps: GATE_20_SCALE_TARGETS.BASEL_X_MIN_CET1_BPS,
    cet1PctLabel: '30.00%',
    minLcrBps: GATE_20_SCALE_TARGETS.BASEL_X_MIN_LCR_BPS,
    lcrPctLabel: '600.00%',
    minNsfrBps: GATE_20_SCALE_TARGETS.BASEL_X_MIN_NSFR_BPS,
    nsfrPctLabel: '220.00%',
    targetBufferCents: GATE_20_SCALE_TARGETS.SOVEREIGN_RESERVE_GRID_USD * 100,
    bufferLabel: '$100.0B',
    minSurvivalDays: 1095,
    survivalLabel: '1,095 days (3 years)',
  });
}
