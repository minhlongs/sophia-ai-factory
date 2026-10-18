/**
 * @file omnipresent-hyper-rtgs-solvency.ts
 * @layer seed/types
 * @description Basel XII solvency and multiverse vault reserve types for Gate 22 Omnipresent Hyper-RTGS.
 */

export type BaselXiiSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_DEFICIT'
  | 'SUPERVISORY_INTERVENTION';

export interface BaselXiiSolvencySnapshot {
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
  isBaselXiiCompliant: boolean;
  supervisorySignature: string;
  createdAt?: string;
}

export type MultiverseVaultHub =
  | 'OMNIPRESENT_CORE'
  | 'MULTIVERSE_SINGULARITY_HUB'
  | 'VIRGO_MEGA_MATRIX'
  | 'SUB_PLANCK_QUANTUM_VAULT'
  | 'COSMOLOGICAL_GATEWAY';

export const ALL_MULTIVERSE_VAULT_HUBS: MultiverseVaultHub[] = [
  'OMNIPRESENT_CORE',
  'MULTIVERSE_SINGULARITY_HUB',
  'VIRGO_MEGA_MATRIX',
  'SUB_PLANCK_QUANTUM_VAULT',
  'COSMOLOGICAL_GATEWAY',
];

export type MultiverseCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V4_BASKET'
  | 'TIER_1_EQUITIES'
  | 'MULTIVERSE_CREDITS'
  | 'SUB_PLANCK_VACUUM_SINGULARITIES';

export interface MultiverseTreasuryReserve {
  id?: string;
  vaultHubId: MultiverseVaultHub;
  assetType: MultiverseCollateralAsset;
  parValueCents: number;
  haircutPct: number;
  eligibleCollateralValueCents: number;
  isUnencumbered: boolean;
  lastAuditEpoch: string;
  createdAt?: string;
}
