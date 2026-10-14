export interface BaselSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents?: number;
  sovereignCapitalBufferCents?: number;
  stressTestSurvivalDays: number;
}

export interface BaselSolvencyTargets {
  minCet1RatioBps: number;
  minLcrBps: number;
  minNsfrBps: number;
  minSovereignBufferCents?: number;
  minStressSurvivalDays?: number;
  defaultCet1RatioBps?: number;
  defaultLcrBps?: number;
  defaultNsfrBps?: number;
}

export interface BaselSolvencySignatureContext {
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  bufferCents: number;
  stressTestSurvivalDays: number;
  isSolvent: boolean;
  solvencyStatus: string;
}

export interface BaselSolvencyConfig {
  hashPrefix?: string;
  signatureFn?: (ctx: BaselSolvencySignatureContext) => string;
  statusResolver?: (ctx: BaselSolvencySignatureContext, violations: string[]) => string;
  violationsGenerator?: (
    ctx: BaselSolvencySignatureContext,
    targets: BaselSolvencyTargets,
    input: BaselSolvencyInput
  ) => string[];
}

export interface BaselSolvencyResult {
  isSolvent: boolean;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents?: number;
  sovereignCapitalBufferCents?: number;
  stressTestSurvivalDays: number;
  solvencyStatus?: string;
  violations: string[];
  supervisorySignature: string;
}

export interface CollateralValuationResult {
  assetType: string;
  nominalValueCents: number;
  haircutFactor: number;
  haircutMultiplier: number;
  netValuationCents: number;
}
