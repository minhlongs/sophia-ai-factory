/**
 * Concentrated Liquidity Pool Repository
 * Layer: TREE (Business Logic)
 */

import type { D1Database } from '@cloudflare/workers-types';
import { type AmmLiquidityPool, rowToAmmLiquidityPool } from './types';

export async function persistPool(db: D1Database, pool: AmmLiquidityPool): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO amm_liquidity_pools (
        id, pair_symbol, token0_symbol, token1_symbol, token0_decimals,
        token1_decimals, reserve0_amount_units, reserve1_amount_units,
        current_sqrt_price_x96, current_tick, tick_spacing, fee_tier_bps,
        max_slippage_cap_bps, total_value_locked_usd_cents, volume_24h_usd_cents,
        is_circuit_breaker_tripped, last_rebalanced_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      pool.id,
      pool.pairSymbol,
      pool.token0Symbol,
      pool.token1Symbol,
      pool.token0Decimals,
      pool.token1Decimals,
      pool.reserve0AmountUnits,
      pool.reserve1AmountUnits,
      pool.currentSqrtPriceX96,
      pool.currentTick,
      pool.tickSpacing,
      pool.feeTierBps,
      pool.maxSlippageCapBps,
      pool.totalValueLockedUsdCents,
      pool.volume24hUsdCents,
      pool.isCircuitBreakerTripped ? 1 : 0,
      pool.lastRebalancedAt,
      pool.createdAt
    )
    .run();
}

export async function getPoolById(
  db: D1Database,
  poolId: string
): Promise<AmmLiquidityPool | null> {
  const row = await db
    .prepare('SELECT * FROM amm_liquidity_pools WHERE id = ?')
    .bind(poolId)
    .first<Record<string, unknown>>();
  return row ? rowToAmmLiquidityPool(row) : null;
}
