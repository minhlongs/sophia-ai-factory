/**
 * @file basel-xvi-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XVI Pan-Cosmic Solvency & $10.0 Trillion Treasury Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_26_SCALE_TARGETS,
  type BaselXviSolvencyStatus,
  type PanCosmicCollateralAsset,
} from '@/seed/types/pan-cosmic-hyper-rtgs-capital';

export interface BaselXviSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXviSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXviSolvencyStatus;
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
  SSDR_V8_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  MULTIVERSE_CREDITS: 1.25,
  PAN_DIMENSIONAL_QUANTUM_FOAM: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Pan-Cosmic sovereign reserves.
 */
export function calculatePanCosmicCollateralValue(
  pledgedAmountCents: number,
  assetType: PanCosmicCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = PAN_COSMIC_COLLATERAL_HAIRCUTS[assetType] || 1.50;
  const netValuationCents = Math.round(pledgedAmountCents / haircutFactor);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XVI standards.
 */
export function evaluateBaselXviSolvency(input: BaselXviSolvencyInput): BaselXviSolvencyOutput {
  const violations: string[] = [];

  const cet1RatioBps =
    input.totalRiskExposureCents > 0
      ? Math.floor((input.commonEquityTier1Cents / input.totalRiskExposureCents) * 10000)
      : 0;

  const liquidityCoverageRatioBps =
    input.netCashOutflows30DaysCents > 0
      ? Math.floor((input.highQualityLiquidAssetsCents / input.netCashOutflows30DaysCents) * 10000)
      : 0;

  const netStableFundingRatioBps =
    input.requiredStableFundingCents > 0
      ? Math.floor((input.availableStableFundingCents / input.requiredStableFundingCents) * 10000)
      : 0;

  if (cet1RatioBps < GATE_26_SCALE_TARGETS.BASEL_XVI_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XVI requirement of ${GATE_26_SCALE_TARGETS.BASEL_XVI_MIN_CET1_BPS} bps (45.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_26_SCALE_TARGETS.BASEL_XVI_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XVI requirement of ${GATE_26_SCALE_TARGETS.BASEL_XVI_MIN_LCR_BPS} bps (1500.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_26_SCALE_TARGETS.BASEL_XVI_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XVI requirement of ${GATE_26_SCALE_TARGETS.BASEL_XVI_MIN_NSFR_BPS} bps (500.00%)`
    );
  }

  const targetBufferCents = GATE_26_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $10.0T requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 10950) {
    violations.push(
      `Stress test survival ${input.stressTestSurvivalDays} days is below 10,950 days (30 years) requirement`
    );
  }

  const isSolvent = violations.length === 0;

  let solvencyStatus: BaselXviSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (!isSolvent) {
    if (cet1RatioBps < GATE_26_SCALE_TARGETS.BASEL_XVI_MIN_CET1_BPS) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_26_SCALE_TARGETS.BASEL_XVI_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XVI_AUDIT:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
    )
    .digest('hex');

  return {
    isSolvent,
    solvencyStatus,
    cet1RatioBps,
    liquidityCoverageRatioBps,
    netStableFundingRatioBps,
    sovereignCapitalBufferCents: input.sovereignCapitalBufferCents,
    stressTestSurvivalDays: input.stressTestSurvivalDays,
    violations,
    supervisorySignature,
  };
}
