/**
 * amm-clearing-row-mappers.ts — Row mappers for AMM Clearing Vault
 */

import type { AmmLiquidityPool, AmmSwapStatus, AmmSwapTransaction } from './amm-clearing';

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
