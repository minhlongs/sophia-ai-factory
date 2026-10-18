/**
 * @file omniverse-treasury-solvency-types.ts
 * @layer seed/types
 * @description Basel XV solvency and Omniverse Treasury Reserve contracts for Gate 25.
 */

export type BaselXvSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_DEFICIT'
  | 'SUPERVISORY_INTERVENTION';

export interface BaselXvSolvencySnapshot {
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
  isBaselXvCompliant: boolean;
  supervisorySignature: string;
  createdAt?: string;
}

export type OmniverseVaultHub =
  | 'OMNIVERSE_CORE'
  | 'TRANSCENDENTAL_SINGULARITY_HUB'
  | 'MULTIVERSE_TREASURY_VAULT'
  | 'VIRGO_SUPER_MATRIX'
  | 'SUB_PLANCK_QUANTUM_VAULT'
  | 'ZERO_POINT_CONTINUUM_NEXUS'
  | 'TRANSCENDENTAL_SINGULARITY_GATEWAY';

export const ALL_OMNIVERSE_VAULT_HUBS: OmniverseVaultHub[] = [
  'OMNIVERSE_CORE',
  'TRANSCENDENTAL_SINGULARITY_HUB',
  'MULTIVERSE_TREASURY_VAULT',
  'VIRGO_SUPER_MATRIX',
  'SUB_PLANCK_QUANTUM_VAULT',
  'ZERO_POINT_CONTINUUM_NEXUS',
  'TRANSCENDENTAL_SINGULARITY_GATEWAY',
];

export type OmniverseCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V7_BASKET'
  | 'TIER_1_EQUITIES'
  | 'MULTIVERSE_CREDITS'
  | 'TRANSCENDENTAL_VACUUM_SINGULARITIES';

export interface OmniverseTreasuryReserve {
  id?: string;
  vaultHubId: OmniverseVaultHub;
  assetType: OmniverseCollateralAsset;
  parValueCents: number;
  haircutPct: number;
  eligibleCollateralValueCents: number;
  isUnencumbered: boolean;
  lastAuditEpoch: string;
  createdAt?: string;
}
