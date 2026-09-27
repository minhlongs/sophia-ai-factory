import { describe, it, expect } from 'vitest';
import {
  detectTriangularArbitrage,
  executeArbitrageTrade,
} from '../high-frequency-arbitrage-engine';
import type { HftArbitragePool } from '@/seed/types/hectocorn-compute';

describe('High-Frequency Arbitrage Engine Unit Tests', () => {
  const samplePool: HftArbitragePool = {
    id: 'pool_tri_1',
    poolName: 'TRIANGLE_USDT_USDC_USD',
    dexRouterAddress: '0x1111111254fb6c44bac0bed2854e76f90643097d',
    cexClearingGateway: 'https://settle.exchange.sophia/v1',
    totalLiquidityCents: 10_000_000_000,
    rebalancedVolume24hCents: 0,
    arbitrageYieldCapturedCents: 0,
    customerDividendDistributedCents: 0,
    maxSlippageBps: 1, // 0.01%
    isCircuitBreakerActive: false,
    lastArbitrageExecutionAt: null,
    createdAt: new Date().toISOString(),
  };

  it('detects profitable triangular arbitrage opportunity when product > 1.0 + fee', () => {
    const opp = detectTriangularArbitrage({
      poolName: samplePool.poolName,
      tokenA: 'USDT',
      tokenB: 'USDC',
      tokenC: 'USD',
      rateAB: 1.0005,
      rateBC: 1.0008,
      rateCA: 1.0002,
      tradingFeeBps: 3,
    });

    expect(opp.isProfitable).toBe(true);
    expect(opp.netProfitBps).toBeGreaterThan(0);
    expect(opp.grossArbitrageRatio).toBeGreaterThan(1.001);
  });

  it('executes arbitrage trade and allocates 70% of profit to customer dividend pool', () => {
    const opp = detectTriangularArbitrage({
      poolName: samplePool.poolName,
      tokenA: 'USDT',
      tokenB: 'USDC',
      tokenC: 'USD',
      rateAB: 1.001,
      rateBC: 1.001,
      rateCA: 1.001,
      tradingFeeBps: 3,
    });

    const notionalAmountCents = 100_000_000; // $1,000,000 notional
    const execution = executeArbitrageTrade(opp, notionalAmountCents, samplePool);

    expect(execution.executionSucceeded).toBe(true);
    expect(execution.grossProfitCents).toBeGreaterThan(0);
    expect(execution.customerDividendCents).toBe(
      Math.round(execution.grossProfitCents * 0.7),
    );
    expect(execution.retainedReservesCents).toBe(
      execution.grossProfitCents - execution.customerDividendCents,
    );
    expect(execution.slippageBps).toBeLessThanOrEqual(1);
    expect(execution.circuitBreakerTripped).toBe(false);
  });

  it('halts execution when circuit breaker is active', () => {
    const trippedPool: HftArbitragePool = {
      ...samplePool,
      isCircuitBreakerActive: true,
    };

    const opp = detectTriangularArbitrage({
      poolName: samplePool.poolName,
      tokenA: 'USDT',
      tokenB: 'USDC',
      tokenC: 'USD',
      rateAB: 1.05,
      rateBC: 1.05,
      rateCA: 1.05,
    });

    const execution = executeArbitrageTrade(opp, 100_000_000, trippedPool);
    expect(execution.executionSucceeded).toBe(false);
    expect(execution.circuitBreakerTripped).toBe(true);
    expect(execution.grossProfitCents).toBe(0);
  });
});
