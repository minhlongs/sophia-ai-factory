import { describe, expect, it } from 'vitest';
import {
  calculateBaselXliSolvencyRatios,
  evaluateBaselXliSolvencyCompliance,
  valuateDucentiquinquagintaquintillionCollateral,
} from '../basel-xli-solvency-engine';
import { BASEL_XLI_CONSTRAINTS } from '@/seed/types/ducenti-quinquaginta-quintillion-trans-cosmic-hyper-rtgs-capital';

describe('Gate 51 Basel XLI Solvency Engine', () => {
  it('evaluates compliant solvency with sovereign capital buffer', () => {
    const res = evaluateBaselXliSolvencyCompliance({
      commonEquityTier1Cents: 10_000_000_000_000,
      totalRiskExposureCents: 10_000_000_000_000,
      highQualityLiquidAssetsCents: 350_000_000_000_000,
      netCashOutflows30DaysCents: 100_000_000_000,
      availableStableFundingCents: 500_000_000_000_000,
      requiredStableFundingCents: 100_000_000_000,
      sovereignCapitalBufferCents: BASEL_XLI_CONSTRAINTS.SOVEREIGN_CAPITAL_BUFFER_MIN_CENTS,
      stressTestSurvivalDays: BASEL_XLI_CONSTRAINTS.MIN_SURVIVAL_HORIZON_DAYS,
    });

    expect(res.isSolvent).toBe(true);
    expect(res.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(res.cet1RatioBps).toBeGreaterThanOrEqual(BASEL_XLI_CONSTRAINTS.MIN_CET1_RATIO_BPS);
    expect(res.liquidityCoverageRatioBps).toBeGreaterThanOrEqual(BASEL_XLI_CONSTRAINTS.MIN_LIQUIDITY_COVERAGE_RATIO_BPS);
    expect(res.netStableFundingRatioBps).toBeGreaterThanOrEqual(BASEL_XLI_CONSTRAINTS.MIN_NET_STABLE_FUNDING_RATIO_BPS);
    expect(res.supervisorySignature).toBeTruthy();
  });

  it('valuates sovereign collateral with haircuts', () => {
    const res = valuateDucentiquinquagintaquintillionCollateral('PHYSICAL_GOLD', 1_000_000);
    expect(res.haircutMultiplier).toBe(1.005);
    expect(res.netValuationCents).toBe(1_005_000);
  });
});
