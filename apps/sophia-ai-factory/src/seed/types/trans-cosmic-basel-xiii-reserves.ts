/**
 * @file trans-cosmic-basel-xiii-reserves.ts
 * @layer seed/types
 * @description Basel XIII Solvency and Trans-Cosmic Treasury Reserve types for Gate 23.
 */

export type BaselXiiiSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_DEFICIT'
  | 'SUPERVISORY_INTERVENTION';

export interface BaselXiiiSolvencySnapshot {
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
  isBaselXiiiCompliant: boolean;
  supervisorySignature: string;
  createdAt?: string;
}

export type TransCosmicVaultHub =
  | 'TRANS_COSMIC_CORE'
  | 'OMNIPRESENT_SINGULARITY_HUB'
  | 'MULTIVERSE_TREASURY_VAULT'
  | 'VIRGO_SUPER_MATRIX'
  | 'SUB_PLANCK_QUANTUM_VAULT'
  | 'ZERO_POINT_CONTINUUM_NEXUS';

export const ALL_TRANS_COSMIC_VAULT_HUBS: TransCosmicVaultHub[] = [
  'TRANS_COSMIC_CORE',
  'OMNIPRESENT_SINGULARITY_HUB',
  'MULTIVERSE_TREASURY_VAULT',
  'VIRGO_SUPER_MATRIX',
  'SUB_PLANCK_QUANTUM_VAULT',
  'ZERO_POINT_CONTINUUM_NEXUS',
];

export type TransCosmicCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V5_BASKET'
  | 'TIER_1_EQUITIES'
  | 'MULTIVERSE_CREDITS'
  | 'ZERO_POINT_VACUUM_SINGULARITIES';

export interface TransCosmicTreasuryReserve {
  id?: string;
  vaultHubId: TransCosmicVaultHub;
  assetType: TransCosmicCollateralAsset;
  parValueCents: number;
  haircutPct: number;
  eligibleCollateralValueCents: number;
  isUnencumbered: boolean;
  lastAuditEpoch: string;
  createdAt?: string;
}
