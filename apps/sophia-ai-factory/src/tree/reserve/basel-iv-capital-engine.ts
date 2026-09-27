/**
 * @file basel-iv-capital-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel IV Capital Adequacy (CET1, LCR, NSFR) and Collateral Rehypothecation.
 */

import {
  BaselIvCapitalAdequacySnapshot,
  RehypothecatedCollateralAllocation,
  GATE_14_SCALE_TARGETS,
} from '@/seed/types/cls-liquidity';

export interface CapitalAdequacyEvaluation {
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  isCompliant: boolean;
  surplusCapitalCents: number;
  deficitDescription?: string;
}

/**
 * Evaluates full Basel IV capital adequacy against Centicorn super-sovereign standards
 */
export function evaluateBaselIvCapital(
  tier1CapitalCents: number,
  riskWeightedAssetsCents: number,
  hqlaLiquidAssetsCents: number,
  netCashOutflows30dCents: number,
  availableStableFundingCents: number,
  requiredStableFundingCents: number
): CapitalAdequacyEvaluation {
  if (riskWeightedAssetsCents <= 0 || netCashOutflows30dCents <= 0 || requiredStableFundingCents <= 0) {
    throw new Error('Risk-weighted assets and outflow parameters must be strictly positive');
  }

  // 1. CET1 Ratio (min 16.50% = 1650 bps)
  const cet1RatioBps = Math.round((tier1CapitalCents / riskWeightedAssetsCents) * 10000);

  // 2. Liquidity Coverage Ratio (LCR - min 200.00% = 20000 bps)
  const liquidityCoverageRatioBps = Math.round((hqlaLiquidAssetsCents / netCashOutflows30dCents) * 10000);

  // 3. Net Stable Funding Ratio (NSFR - min 125.00% = 12500 bps)
  const netStableFundingRatioBps = Math.round((availableStableFundingCents / requiredStableFundingCents) * 10000);

  const isCet1Ok = cet1RatioBps >= 1650;
  const isLcrOk = liquidityCoverageRatioBps >= 20000;
  const isNsfrOk = netStableFundingRatioBps >= 12500;

  const isCompliant = isCet1Ok && isLcrOk && isNsfrOk;

  // Minimum required capital at 16.5%
  const minRequiredCapitalCents = Math.round(riskWeightedAssetsCents * 0.165);
  const surplusCapitalCents = tier1CapitalCents - minRequiredCapitalCents;

  let deficitDescription: string | undefined;
  if (!isCompliant) {
    const issues: string[] = [];
    if (!isCet1Ok) issues.push(`CET1 ratio ${cet1RatioBps / 100}% below required 16.50%`);
    if (!isLcrOk) issues.push(`LCR ${liquidityCoverageRatioBps / 100}% below required 200.00%`);
    if (!isNsfrOk) issues.push(`NSFR ${netStableFundingRatioBps / 100}% below required 125.00%`);
    deficitDescription = issues.join('; ');
  }

  return {
    cet1RatioBps,
    liquidityCoverageRatioBps,
    netStableFundingRatioBps,
    isCompliant,
    surplusCapitalCents,
    deficitDescription,
  };
}

/**
 * Calculates effective rehypothecated value with tier-based risk haircut
 */
export function calculateRehypothecationValue(
  allocation: RehypothecatedCollateralAllocation
): { netAvailableValueCents: number; haircutDeductedCents: number } {
  // Tier 1: 1.0x haircut multiplier, Tier 2: 1.5x, Tier 3: 2.0x
  const tierMultiplier = allocation.rehypothecationTier === 1 ? 1.0 : allocation.rehypothecationTier === 2 ? 1.5 : 2.0;
  const effectiveHaircutPct = allocation.haircutPercentage * tierMultiplier;

  const haircutDeductedCents = Math.round((allocation.pledgedValueCents * effectiveHaircutPct) / 100);
  const netAvailableValueCents = Math.max(0, allocation.pledgedValueCents - haircutDeductedCents);

  return {
    netAvailableValueCents,
    haircutDeductedCents,
  };
}
