/**
 * amm-clearing.ts — Gate 11 Milestone Seed Types
 * Pillar 3: Concentrated Liquidity AMM Clearing Vault, Slippage Caps & Dynamic Multi-Currency Treasury Rebalancer
 *
 * Target: Institutional AMM supporting $10M+ monthly throughput with ≤0.03% slippage cap
 */

export const AMM_CONSTANTS = {
  MAX_INSTITUTIONAL_SLIPPAGE_BPS: 3, // 3 bps = 0.03%
  CIRCUIT_BREAKER_DEVIATION_BPS: 1000, // 10.00% threshold
  MIN_FEE_TIER_BPS: 1, // 0.01%
  MAX_FEE_TIER_BPS: 20, // 0.20%
  DEFAULT_FEE_TIER_BPS: 5, // 0.05%
  Q96: BigInt(2) ** BigInt(96),
} as const;

export type AmmSwapStatus = 'PENDING' | 'EXECUTED' | 'SLIPPAGE_REJECTED' | 'CIRCUIT_BREAKER_HALTED';
export type RebalanceTriggerReason = 'SCHEDULED_PERIODIC' | 'DEVIATION_THRESHOLD' | 'EMERGENCY_ARBITRAGE' | 'MANUAL_DISPATCH';
export type RebalanceStatus = 'PROPOSED' | 'APPROVED' | 'SETTLED' | 'FAILED';

export interface AmmLiquidityPool {
  id: string;
  pairSymbol: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  reserve0AmountUnits: string;
  reserve1AmountUnits: string;
  currentSqrtPriceX96: string;
  currentTick: number;
  tickSpacing: number;
  feeTierBps: number;
  maxSlippageCapBps: number;
  totalValueLockedUsdCents: number;
  volume24hUsdCents: number;
  isCircuitBreakerTripped: boolean;
  lastRebalancedAt: string | null;
  createdAt: string;
}

export interface AmmSwapTransaction {
  id: string;
  poolId: string;
  traderIdentifier: string;
  recipientAddress: string;
  amountInUnits: string;
  amountOutUnits: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  effectivePriceRatio: number;
  slippageExperiencedBps: number;
  feeCollectedCents: number;
  antiSandwichNonce: number;
  mevProtectionProof: string;
  executionStatus: AmmSwapStatus;
  createdAt: string;
}

export interface TreasuryRebalanceEvent {
  id: string;
  triggerReason: RebalanceTriggerReason;
  sourcePoolId: string;
  targetPoolId: string;
  currencyMoved: string;
  amountMovedUnits: string;
  deviationBps: number;
  preRebalanceRatio: number;
  postRebalanceRatio: number;
  multisigOperatorQuorum: string;
  status: RebalanceStatus;
  executedAt: string;
}

export interface AmmSwapQuoteRequest {
  poolId: string;
  tokenInSymbol: string;
  amountInUnits: string;
  maxAcceptableSlippageBps?: number;
  traderIdentifier: string;
}

export interface AmmSwapQuoteResult {
  poolId: string;
  amountInUnits: string;
  expectedAmountOutUnits: string;
  minAmountOutUnits: string;
  estimatedSlippageBps: number;
  feeUnits: string;
  feeUsdCents: number;
  effectivePriceRatio: number;
  isApproved: boolean;
  rejectReason?: string;
}

export function rowToAmmLiquidityPool(row: Record<string, unknown>): AmmLiquidityPool {
  return {
    id: String(row.id),
    pairSymbol: String(row.pair_symbol),
    token0Symbol: String(row.token0_symbol),
    token1Symbol: String(row.token1_symbol),
    token0Decimals: Number(row.token0_decimals),
    token1Decimals: Number(row.token1_decimals),
    reserve0AmountUnits: String(row.reserve0_amount_units),
    reserve1AmountUnits: String(row.reserve1_amount_units),
    currentSqrtPriceX96: String(row.current_sqrt_price_x96),
    currentTick: Number(row.current_tick),
    tickSpacing: Number(row.tick_spacing),
    feeTierBps: Number(row.fee_tier_bps),
    maxSlippageCapBps: Number(row.max_slippage_cap_bps),
    totalValueLockedUsdCents: Number(row.total_value_locked_usd_cents),
    volume24hUsdCents: Number(row.volume_24h_usd_cents),
    isCircuitBreakerTripped: Number(row.is_circuit_breaker_tripped) === 1,
    lastRebalancedAt: row.last_rebalanced_at ? String(row.last_rebalanced_at) : null,
    createdAt: String(row.created_at),
  };
}

export function rowToAmmSwapTransaction(row: Record<string, unknown>): AmmSwapTransaction {
  return {
    id: String(row.id),
    poolId: String(row.pool_id),
    traderIdentifier: String(row.trader_identifier),
    recipientAddress: String(row.recipient_address),
    amountInUnits: String(row.amount_in_units),
    amountOutUnits: String(row.amount_out_units),
    tokenInSymbol: String(row.token_in_symbol),
    tokenOutSymbol: String(row.token_out_symbol),
    effectivePriceRatio: Number(row.effective_price_ratio),
    slippageExperiencedBps: Number(row.slippage_experienced_bps),
    feeCollectedCents: Number(row.fee_collected_cents),
    antiSandwichNonce: Number(row.anti_sandwich_nonce),
    mevProtectionProof: String(row.mev_protection_proof),
    executionStatus: String(row.execution_status) as AmmSwapStatus,
    createdAt: String(row.created_at),
  };
}
