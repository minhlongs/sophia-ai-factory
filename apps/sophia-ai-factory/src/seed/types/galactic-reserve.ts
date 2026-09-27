/**
 * @file galactic-reserve.ts
 * @layer seed/types
 * @description Seed types & scale constants for Gate 13: $50,000,000 MRR ($600M ARR, 200,000 Paid Customers)
 * Centicorn Galactic AI Economy & Sovereign Reserve Currency Vault (Bilateral/Trilateral Swap Lines & sSDR).
 */

export const GATE_13_SCALE_TARGETS = {
  MRR_TARGET_USD: 50_000_000,
  ARR_TARGET_USD: 600_000_000,
  ACTIVE_PAID_CUSTOMERS: 200_000,
  ARPU_USD: 250,
  NET_REVENUE_RETENTION_PERCENT: 155,
  EIGHT_NINES_UPTIME_PERCENT: 99.999999,
  RESERVE_BUFFER_TARGET_USD: 500_000_000,
} as const;

export type SovereignFacilityType = 'BILATERAL' | 'TRILATERAL' | 'MULTILATERAL_STANDBY';
export type ReserveCurrency = 'USD' | 'EUR' | 'SGD' | 'JPY' | 'GBP' | 'SSDR';
export type CounterpartyCreditRating = 'AAA' | 'AA_PLUS' | 'AA' | 'A_PLUS' | 'SOVEREIGN_PRIME';
export type SovereignSwapStatus = 'ACTIVE' | 'SUSPENDED' | 'SETTLING' | 'EXPIRED';

export interface SovereignSwapLine {
  id: string;
  lineCode: string;
  primaryCentralBank: string;
  counterpartyCentralBank: string;
  facilityType: SovereignFacilityType;
  baseCurrency: ReserveCurrency;
  quoteCurrency: ReserveCurrency;
  creditLimitCents: number;
  drawnAmountCents: number;
  interestSpreadBps: number;
  collateralHaircutBps: number;
  counterpartyRating: CounterpartyCreditRating;
  status: SovereignSwapStatus;
  expiresAt: string;
  createdAt: string;
}

export interface SsdrCurrencyBasket {
  id: string;
  basketVersion: string;
  usdWeightBps: number; // e.g. 4338 (43.38%)
  eurWeightBps: number; // e.g. 2931 (29.31%)
  cnyWeightBps: number; // e.g. 1228 (12.28%)
  jpyWeightBps: number; // e.g. 759 (7.59%)
  gbpWeightBps: number; // e.g. 744 (7.44%)
  calculatedIndexCents: number; // Index price in USD cents per 1 sSDR
  totalSsdrSupply: number;
  reserveBackingRatioBps: number; // e.g. 12500 (125%)
  isActive: boolean;
  lastRebalancedAt: string;
  createdAt: string;
}

export type ReserveOperationType =
  | 'MINT_SSDR'
  | 'BURN_SSDR'
  | 'INJECT_USD_BUFFER'
  | 'REBALANCE_CORRIDOR'
  | 'ARBITRAGE_ABSORPTION';

export interface ReserveStabilizationEvent {
  id: string;
  eventRef: string;
  operationType: ReserveOperationType;
  currency: ReserveCurrency;
  amountCents: number;
  preStabilizationBackingBps: number;
  postStabilizationBackingBps: number;
  clearingHash: string;
  status: 'COMMITTED' | 'AUDITED' | 'SETTLED';
  createdAt: string;
}

export type SovereignVaultJurisdiction =
  | 'US_FEDERAL_RESERVE_NY'
  | 'EURO_SYSTEM_FRANKFURT'
  | 'MONETARY_AUTHORITY_SINGAPORE'
  | 'SOPHIA_SWISS_VAULT';

export interface GalacticLiquidityBuffer {
  id: string;
  vaultIdentifier: string;
  jurisdiction: SovereignVaultJurisdiction;
  allocatedTargetCents: number;
  availableBalanceCents: number;
  lockedEscrowCents: number;
  healthFactor: number;
  lastAuditProofSha256: string;
  updatedAt: string;
  createdAt: string;
}

export interface SwapExecutionRequest {
  lineCode: string;
  drawAmountCents: number;
  tenorDays: number;
  baseInterestRateBps: number;
}

export interface SwapExecutionResult {
  swapReference: string;
  executedBaseCents: number;
  convertedQuoteCents: number;
  effectiveRate: number;
  haircutDeductedCents: number;
  interestOwedCents: number;
  repaymentDueAt: string;
  clearingProofSha256: string;
}

export interface SsdrValuationQuote {
  usdPriceCents: number;
  eurPriceCents: number;
  cnyPriceCents: number;
  jpyPriceCents: number;
  gbpPriceCents: number;
}
