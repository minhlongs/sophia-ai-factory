/**
 * @file pan-galactic-solvency-vault.ts
 * @layer seed/types
 * @description Basel XIV Solvency & Pan-Galactic Vault Hub types for Gate 24.
 */

export type BaselXivSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_DEFICIT'
  | 'SUPERVISORY_INTERVENTION';

export interface BaselXivSolvencySnapshot {
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
  isBaselXivCompliant: boolean;
  supervisorySignature: string;
  createdAt?: string;
}

export type PanGalacticVaultHub =
  | 'PAN_GALACTIC_CORE'
  | 'OMNIPRESENT_SINGULARITY_HUB'
  | 'MULTIVERSE_TREASURY_VAULT'
  | 'VIRGO_SUPER_MATRIX'
  | 'SUB_PLANCK_QUANTUM_VAULT'
  | 'ZERO_POINT_CONTINUUM_NEXUS';

export const ALL_PAN_GALACTIC_VAULT_HUBS: PanGalacticVaultHub[] = [
  'PAN_GALACTIC_CORE',
  'OMNIPRESENT_SINGULARITY_HUB',
  'MULTIVERSE_TREASURY_VAULT',
  'VIRGO_SUPER_MATRIX',
  'SUB_PLANCK_QUANTUM_VAULT',
  'ZERO_POINT_CONTINUUM_NEXUS',
];

export type PanGalacticCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V6_BASKET'
  | 'TIER_1_EQUITIES'
  | 'MULTIVERSE_CREDITS'
  | 'ABSOLUTE_VACUUM_SINGULARITIES';

export interface PanGalacticTreasuryReserve {
  id?: string;
  vaultHubId: PanGalacticVaultHub;
  assetType: PanGalacticCollateralAsset;
  parValueCents: number;
  haircutPct: number;
  eligibleCollateralValueCents: number;
  isUnencumbered: boolean;
  lastAuditEpoch: string;
  createdAt?: string;
}
