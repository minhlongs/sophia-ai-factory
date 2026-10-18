/**
 * @file pan-cosmic-hyper-rtgs-reserves.ts
 * @layer seed/types
 * @description Basel XVI solvency and Pan-Cosmic treasury reserve types & vault hubs for Gate 26.
 */

export type BaselXviSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_DEFICIT'
  | 'SUPERVISORY_INTERVENTION';

export interface BaselXviSolvencySnapshot {
  id?: string;
  snapshotRef: string;
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  cet1RatioBps: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30dCents: number;
  liquidityCoverageRatioBps: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  isBaselXviCompliant: boolean;
  supervisorySignature: string;
  createdAt?: string;
}

export type PanCosmicVaultHub =
  | 'OMNIVERSE_CORE'
  | 'PAN_COSMIC_SINGULARITY_HUB'
  | 'TRANS_DIMENSIONAL_TREASURY_VAULT'
  | 'VIRGO_HYPER_MATRIX'
  | 'SUB_PLANCK_QUANTUM_VAULT'
  | 'ZERO_POINT_CONTINUUM_NEXUS'
  | 'ABSOLUTE_SINGULARITY_GATEWAY';

export const ALL_PAN_COSMIC_VAULT_HUBS: PanCosmicVaultHub[] = [
  'OMNIVERSE_CORE',
  'PAN_COSMIC_SINGULARITY_HUB',
  'TRANS_DIMENSIONAL_TREASURY_VAULT',
  'VIRGO_HYPER_MATRIX',
  'SUB_PLANCK_QUANTUM_VAULT',
  'ZERO_POINT_CONTINUUM_NEXUS',
  'ABSOLUTE_SINGULARITY_GATEWAY',
];

export type PanCosmicCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V8_BASKET'
  | 'TIER_1_EQUITIES'
  | 'MULTIVERSE_CREDITS'
  | 'PAN_DIMENSIONAL_QUANTUM_FOAM';

export interface PanCosmicTreasuryReserve {
  id?: string;
  vaultHubId: PanCosmicVaultHub;
  assetType: PanCosmicCollateralAsset;
  parValueCents: number;
  haircutPct: number;
  eligibleCollateralValueCents: number;
  isUnencumbered: boolean;
  lastAuditEpoch: string;
  createdAt?: string;
}
