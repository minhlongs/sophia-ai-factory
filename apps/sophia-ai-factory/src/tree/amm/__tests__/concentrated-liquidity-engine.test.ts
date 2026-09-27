/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import type { AmmLiquidityPool, AmmSwapQuoteRequest } from '@/seed/types/amm-clearing';
import { ConcentratedLiquidityEngine } from '../concentrated-liquidity-engine';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('ConcentratedLiquidityEngine — Unit Tests', () => {
  let db: D1Database;

  const mockPool: AmmLiquidityPool = {
    id: 'pool_usdt_usd_1',
    pairSymbol: 'USDT_USD',
    token0Symbol: 'USDT',
    token1Symbol: 'USD',
    token0Decimals: 6,
    token1Decimals: 6,
    reserve0AmountUnits: '1000000000000', // 1,000,000 USDT (6 decimals)
    reserve1AmountUnits: '1000000000000', // 1,000,000 USD (6 decimals)
    currentSqrtPriceX96: '79228162514264337593543950336', // 1.0 in Q96
    currentTick: 0,
    tickSpacing: 10,
    feeTierBps: 5, // 0.05%
    maxSlippageCapBps: 3, // 0.03%
    totalValueLockedUsdCents: 200_000_000, // $2M TVL
    volume24hUsdCents: 50_000_000, // $500K 24h vol
    isCircuitBreakerTripped: false,
    lastRebalancedAt: null,
    createdAt: '2026-09-27T00:00:00Z',
  };

  beforeEach(() => {
    const rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS amm_liquidity_pools (
        id TEXT PRIMARY KEY,
        pair_symbol TEXT NOT NULL UNIQUE,
        token0_symbol TEXT NOT NULL,
        token1_symbol TEXT NOT NULL,
        token0_decimals INTEGER NOT NULL,
        token1_decimals INTEGER NOT NULL,
        reserve0_amount_units TEXT NOT NULL,
        reserve1_amount_units TEXT NOT NULL,
        current_sqrt_price_x96 TEXT NOT NULL,
        current_tick INTEGER NOT NULL,
        tick_spacing INTEGER NOT NULL,
        fee_tier_bps INTEGER NOT NULL,
        max_slippage_cap_bps INTEGER NOT NULL,
        total_value_locked_usd_cents INTEGER NOT NULL,
        volume_24h_usd_cents INTEGER NOT NULL,
        is_circuit_breaker_tripped INTEGER NOT NULL,
        last_rebalanced_at TEXT,
        created_at TEXT NOT NULL
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('1. Swap Calculations & Slippage Capping', () => {
    it('approves a small swap with negligible slippage (<= 3 bps)', () => {
      const request: AmmSwapQuoteRequest = {
        poolId: mockPool.id,
        tokenInSymbol: 'USDT',
        amountInUnits: '100000000', // 100 USDT
        traderIdentifier: 'trader_corp_1',
      };

      const quote = ConcentratedLiquidityEngine.calculateSwapQuote(mockPool, request);
      expect(quote.isApproved).toBe(true);
      expect(quote.estimatedSlippageBps).toBeLessThanOrEqual(3);
      expect(Number(quote.expectedAmountOutUnits)).toBeGreaterThan(0);
      expect(quote.effectivePriceRatio).toBeCloseTo(1.0, 2);
    });

    it('rejects an outsized swap that exceeds maximum institutional slippage cap', () => {
      const request: AmmSwapQuoteRequest = {
        poolId: mockPool.id,
        tokenInSymbol: 'USDT',
        amountInUnits: '200000000000', // 200,000 USDT against 1M pool (20% of pool!)
        traderIdentifier: 'whale_1',
      };

      const quote = ConcentratedLiquidityEngine.calculateSwapQuote(mockPool, request);
      expect(quote.isApproved).toBe(false);
      expect(quote.estimatedSlippageBps).toBeGreaterThan(3);
      expect(quote.rejectReason).toContain('exceeds maximum threshold');
    });

    it('blocks swaps when circuit breaker is tripped', () => {
      const haltedPool = { ...mockPool, isCircuitBreakerTripped: true };
      const request: AmmSwapQuoteRequest = {
        poolId: mockPool.id,
        tokenInSymbol: 'USDT',
        amountInUnits: '100000000',
        traderIdentifier: 'trader_1',
      };

      const quote = ConcentratedLiquidityEngine.calculateSwapQuote(haltedPool, request);
      expect(quote.isApproved).toBe(false);
      expect(quote.rejectReason).toContain('Circuit breaker is tripped');
    });
  });

  describe('2. Anti-Sandwich MEV Protection Proof', () => {
    it('executes swap and computes cryptographic MEV protection proof', () => {
      const request: AmmSwapQuoteRequest = {
        poolId: mockPool.id,
        tokenInSymbol: 'USDT',
        amountInUnits: '100000000',
        traderIdentifier: 'trader_corp_1',
      };

      const { transaction, updatedPool } = ConcentratedLiquidityEngine.executeSwap(
        mockPool,
        request,
        '0xrecipientAddress123',
        42
      );

      expect(transaction.executionStatus).toBe('EXECUTED');
      expect(transaction.antiSandwichNonce).toBe(42);
      expect(transaction.mevProtectionProof).toHaveLength(64);

      // Reserve 0 increased by 100 USDT, Reserve 1 decreased by amount out
      expect(Number(updatedPool.reserve0AmountUnits)).toBeGreaterThan(Number(mockPool.reserve0AmountUnits));
      expect(Number(updatedPool.reserve1AmountUnits)).toBeLessThan(Number(mockPool.reserve1AmountUnits));
    });
  });

  describe('3. D1 Persistence', () => {
    it('persists and retrieves AMM pool from D1', async () => {
      await ConcentratedLiquidityEngine.persistPool(db, mockPool);
      const loaded = await ConcentratedLiquidityEngine.getPoolById(db, mockPool.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(mockPool.id);
      expect(loaded?.pairSymbol).toBe('USDT_USD');
    });
  });
});
