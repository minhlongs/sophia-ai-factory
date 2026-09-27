import { describe, it, expect } from 'vitest';
import {
  evaluateBaselIvCapital,
  calculateRehypothecationValue,
} from '../basel-iv-capital-engine';
import type { RehypothecatedCollateralAllocation } from '@/seed/types/cls-liquidity';

describe('Basel IV Capital Adequacy Engine Unit Tests', () => {
  it('evaluates compliant capital structure meeting CET1 > 16.5%, LCR > 200%, NSFR > 125%', () => {
    const tier1CapitalCents = 20_000_000_000;         // $200M
    const riskWeightedAssetsCents = 100_000_000_000;  // $1B RWA -> CET1 = 20.00%
    const hqlaLiquidAssetsCents = 50_000_000_000;     // $500M HQLA
    const netCashOutflows30dCents = 20_000_000_000;   // $200M outflow -> LCR = 250.00%
    const availableStableFundingCents = 80_000_000_000;
    const requiredStableFundingCents = 50_000_000_000; // NSFR = 160.00%

    const evalResult = evaluateBaselIvCapital(
      tier1CapitalCents,
      riskWeightedAssetsCents,
      hqlaLiquidAssetsCents,
      netCashOutflows30dCents,
      availableStableFundingCents,
      requiredStableFundingCents
    );

    expect(evalResult.isCompliant).toBe(true);
    expect(evalResult.cet1RatioBps).toBe(2000); // 20.00%
    expect(evalResult.liquidityCoverageRatioBps).toBe(25000); // 250.00%
    expect(evalResult.netStableFundingRatioBps).toBe(16000); // 160.00%
    expect(evalResult.surplusCapitalCents).toBeGreaterThan(0);
    expect(evalResult.deficitDescription).toBeUndefined();
  });

  it('detects deficit when CET1 or LCR fall below Basel IV minimum thresholds', () => {
    const tier1CapitalCents = 15_000_000_000;        // 15% CET1 (< 16.5%)
    const riskWeightedAssetsCents = 100_000_000_000;
    const hqlaLiquidAssetsCents = 30_000_000_000;    // 150% LCR (< 200%)
    const netCashOutflows30dCents = 20_000_000_000;
    const availableStableFundingCents = 60_000_000_000;
    const requiredStableFundingCents = 50_000_000_000;

    const evalResult = evaluateBaselIvCapital(
      tier1CapitalCents,
      riskWeightedAssetsCents,
      hqlaLiquidAssetsCents,
      netCashOutflows30dCents,
      availableStableFundingCents,
      requiredStableFundingCents
    );

    expect(evalResult.isCompliant).toBe(false);
    expect(evalResult.deficitDescription).toContain('CET1 ratio 15% below required 16.50%');
    expect(evalResult.deficitDescription).toContain('LCR 150% below required 200.00%');
  });

  it('calculates tiered rehypothecation haircuts', () => {
    const tier1Alloc: RehypothecatedCollateralAllocation = {
      id: 'alloc_01',
      allocationRef: 'ALLOC_T1',
      collateralAssetType: 'US_TREASURY_BILLS',
      originalOwnerId: 'institution_alpha',
      pledgedValueCents: 10_000_000_000,
      rehypothecatedTargetPool: 'GLOBAL_POOL_1',
      haircutPercentage: 1.5,
      rehypothecationTier: 1, // 1.0x multiplier
      isRingfenced: true,
      lastAuditedAt: '2026-09-27T00:00:00Z',
      createdAt: '2026-09-27T00:00:00Z',
    };

    const valT1 = calculateRehypothecationValue(tier1Alloc);
    expect(valT1.haircutDeductedCents).toBe(150_000_000); // 1.5% of $100M

    const tier3Alloc: RehypothecatedCollateralAllocation = {
      ...tier1Alloc,
      allocationRef: 'ALLOC_T3',
      rehypothecationTier: 3, // 2.0x multiplier -> 3.0%
    };

    const valT3 = calculateRehypothecationValue(tier3Alloc);
    expect(valT3.haircutDeductedCents).toBe(300_000_000); // 3.0% of $100M
    expect(valT3.netAvailableValueCents).toBe(9_700_000_000);
  });
});
