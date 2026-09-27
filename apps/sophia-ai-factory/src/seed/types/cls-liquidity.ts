/**
 * @file cls-liquidity.ts
 * @layer seed/types
 * @description Seed types & scale constants for Gate 14: $100,000,000 MRR ($1.2B ARR, 400,000 Paid Customers)
 * Centicorn Galactic AI Super-Civilization: CLS PvP Settlement & $1B Sovereign Liquidity Mesh.
 */

export const GATE_14_SCALE_TARGETS = {
  MRR_TARGET_USD: 100_000_000,
  ARR_TARGET_USD: 1_200_000_000,
  ACTIVE_PAID_CUSTOMERS: 400_000,
  ARPU_USD: 250,
  NET_REVENUE_RETENTION_PERCENT: 160,
  NINE_NINES_UPTIME_PERCENT: 99.9999999,
  SOVEREIGN_BUFFER_TARGET_USD: 1_000_000_000,
} as const;

export type SettlementCurrency = 'USD' | 'EUR' | 'SGD' | 'JPY' | 'GBP' | 'SSDR';
export type AtomicPvpStatus = 'MATCHED' | 'PENDING_DUAL_LEG_HOLD' | 'EXECUTED_PVP' | 'ROLLED_BACK_REVERSED';

export interface ClsPvpSettlementSession {
  id: string;
  sessionRef: string;
  leg1Currency: SettlementCurrency;
  leg1AmountCents: number;
  leg1SourceInstitution: string;
  leg2Currency: SettlementCurrency;
  leg2AmountCents: number;
  leg2SourceInstitution: string;
  exchangeRate: number;
  atomicStatus: AtomicPvpStatus;
  clearingHashSha256: string;
  settledAt?: string;
  createdAt: string;
}

export type CollateralAssetType =
  | 'US_TREASURY_BILLS'
  | 'SOVEREIGN_GOLD_BULLION'
  | 'SSDR_STABLE_BASKET'
  | 'TIER_1_EQUITY_INDEX';

export interface RehypothecatedCollateralAllocation {
  id: string;
  allocationRef: string;
  collateralAssetType: CollateralAssetType;
  originalOwnerId: string;
  pledgedValueCents: number;
  rehypothecatedTargetPool: string;
  haircutPercentage: number;
  rehypothecationTier: 1 | 2 | 3;
  isRingfenced: boolean;
  lastAuditedAt: string;
  createdAt: string;
}

export interface BaselIvCapitalAdequacySnapshot {
  id: string;
  auditQuarter: string;
  tier1CapitalCents: number;
  riskWeightedAssetsCents: number;
  cet1RatioBps: number; // min 1650 (16.50%)
  liquidityCoverageRatioBps: number; // min 20000 (200.00%)
  netStableFundingRatioBps: number; // min 12500 (125.00%)
  sovereignBufferAllocatedCents: number;
  isCompliant: boolean;
  snapshotHash: string;
  createdAt: string;
}

export interface PvpExecutionRequest {
  sessionRef: string;
  leg1AmountCents: number;
  leg2AmountCents: number;
  leg1Currency: SettlementCurrency;
  leg2Currency: SettlementCurrency;
  spotRate: number;
}

export interface PvpExecutionResult {
  sessionRef: string;
  status: AtomicPvpStatus;
  executedLeg1Cents: number;
  executedLeg2Cents: number;
  atomicSettlementProofSha256: string;
  settledTimestamp: string;
}
