/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import type { AmmLiquidityPool } from '@/seed/types/amm-clearing';
import { TreasuryRebalancer } from '../treasury-rebalancer';

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

describe('TreasuryRebalancer — Unit Tests', () => {
  let db: D1Database;

  const balancedPool: AmmLiquidityPool = {
    id: 'pool_usdt_usd',
    pairSymbol: 'USDT_USD',
    token0Symbol: 'USDT',
    token1Symbol: 'USD',
    token0Decimals: 6,
    token1Decimals: 6,
    reserve0AmountUnits: '1000000000000',
    reserve1AmountUnits: '1000000000000',
    currentSqrtPriceX96: '79228162514264337593543950336',
    currentTick: 0,
    tickSpacing: 10,
    feeTierBps: 5,
    maxSlippageCapBps: 3,
    totalValueLockedUsdCents: 200_000_000,
    volume24hUsdCents: 50_000_000,
    isCircuitBreakerTripped: false,
    lastRebalancedAt: null,
    createdAt: '2026-09-27T00:00:00Z',
  };

  beforeEach(() => {
    const rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS treasury_rebalance_events (
        id TEXT PRIMARY KEY,
        trigger_reason TEXT NOT NULL,
        source_pool_id TEXT NOT NULL,
        target_pool_id TEXT NOT NULL,
        currency_moved TEXT NOT NULL,
        amount_moved_units TEXT NOT NULL,
        deviation_bps INTEGER NOT NULL,
        pre_rebalance_ratio REAL NOT NULL,
        post_rebalance_ratio REAL NOT NULL,
        multisig_operator_quorum TEXT NOT NULL,
        status TEXT NOT NULL,
        executed_at TEXT NOT NULL
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('1. Reserve Deviation Evaluation', () => {
    it('detects balanced pool with zero deviation and recommends NONE', () => {
      const evaluation = TreasuryRebalancer.evaluatePoolDeviation(balancedPool);
      expect(evaluation.deviationBps).toBe(0);
      expect(evaluation.isRebalanceNeeded).toBe(false);
      expect(evaluation.shouldTripCircuitBreaker).toBe(false);
      expect(evaluation.recommendedAction).toBe('NONE');
    });

    it('triggers rebalancing when deviation exceeds 1000 bps (10%)', () => {
      const driftedPool: AmmLiquidityPool = {
        ...balancedPool,
        reserve0AmountUnits: '1150000000000', // 1.15M
        reserve1AmountUnits: '1000000000000', // 1.00M -> 15% deviation
      };

      const evaluation = TreasuryRebalancer.evaluatePoolDeviation(driftedPool);
      expect(evaluation.deviationBps).toBe(1500); // 15%
      expect(evaluation.isRebalanceNeeded).toBe(true);
      expect(evaluation.shouldTripCircuitBreaker).toBe(false);
      expect(evaluation.recommendedAction).toBe('REBALANCE');
    });

    it('trips circuit breaker when extreme deviation exceeds 3000 bps (30%)', () => {
      const extremePool: AmmLiquidityPool = {
        ...balancedPool,
        reserve0AmountUnits: '1400000000000', // 1.40M
        reserve1AmountUnits: '1000000000000', // 1.00M -> 40% deviation
      };

      const evaluation = TreasuryRebalancer.evaluatePoolDeviation(extremePool);
      expect(evaluation.deviationBps).toBe(4000);
      expect(evaluation.shouldTripCircuitBreaker).toBe(true);
      expect(evaluation.recommendedAction).toBe('HALT_TRADING');
    });
  });

  describe('2. Multi-Sig Rebalance Execution', () => {
    it('settles rebalance when operator quorum (>= 2) is met', () => {
      const targetPool: AmmLiquidityPool = {
        ...balancedPool,
        id: 'pool_usdt_eur',
        pairSymbol: 'USDT_EUR',
      };

      const { event, rebalancedSourcePool } = TreasuryRebalancer.executeRebalance(
        balancedPool,
        targetPool,
        'USDT',
        '50000000000', // 50K USDT
        ['operator_1_key', 'operator_2_key']
      );

      expect(event.status).toBe('SETTLED');
      expect(event.multisigOperatorQuorum).toContain('operator_1_key;operator_2_key');
      expect(Number(rebalancedSourcePool.reserve0AmountUnits)).toBe(950000000000);
    });

    it('marks rebalance as PROPOSED when only 1 operator signs', () => {
      const targetPool: AmmLiquidityPool = {
        ...balancedPool,
        id: 'pool_usdt_eur',
        pairSymbol: 'USDT_EUR',
      };

      const { event } = TreasuryRebalancer.executeRebalance(
        balancedPool,
        targetPool,
        'USDT',
        '50000000000',
        ['single_operator_key']
      );

      expect(event.status).toBe('PROPOSED');
    });
  });

  describe('3. D1 Persistence', () => {
    it('records rebalance event into D1', async () => {
      const targetPool = { ...balancedPool, id: 'pool_usdt_eur' };
      const { event } = TreasuryRebalancer.executeRebalance(
        balancedPool,
        targetPool,
        'USDT',
        '10000000000',
        ['op1', 'op2']
      );

      await TreasuryRebalancer.recordRebalanceEvent(db, event);

      const rows = await db.prepare('SELECT * FROM treasury_rebalance_events WHERE id = ?').bind(event.id).all();
      expect(rows.results).toHaveLength(1);
    });
  });
});
