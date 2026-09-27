/**
 * high-frequency-arbitrage-engine.ts — Tree Layer Pure Domain Engine
 * High-Frequency Institutional Arbitrage & MEV Dividend Vault
 */

import type { HftArbitragePool } from '@/seed/types/hectocorn-compute';

export interface TriangularOpportunity {
  poolName: string;
  tokenA: string;
  tokenB: string;
  tokenC: string;
  rateAB: number; // e.g. USDT -> USDC = 1.0001
  rateBC: number; // e.g. USDC -> USD = 1.0002
  rateCA: number; // e.g. USD -> USDT = 0.9999
  grossArbitrageRatio: number;
  netProfitBps: number;
  isProfitable: boolean;
}

export interface ArbitrageExecutionResult {
  poolName: string;
  notionalAmountCents: number;
  grossProfitCents: number;
  retainedReservesCents: number;
  customerDividendCents: number; // 70% of MEV/arbitrage profit shared back to customers
  slippageBps: number;
  executionSucceeded: boolean;
  circuitBreakerTripped: boolean;
}

/**
 * Detects triangular arbitrage opportunity across 3 asset pairs:
 * Product of rates: R_AB * R_BC * R_CA. If > 1.0 + fees, opportunity exists.
 */
export function detectTriangularArbitrage(params: {
  poolName: string;
  tokenA: string;
  tokenB: string;
  tokenC: string;
  rateAB: number;
  rateBC: number;
  rateCA: number;
  tradingFeeBps?: number;
}): TriangularOpportunity {
  const feeBps = params.tradingFeeBps ?? 3; // 3 bps default total fee
  const feeMultiplier = Math.pow(1 - feeBps / 10_000, 3);
  const grossArbitrageRatio = params.rateAB * params.rateBC * params.rateCA;
  const netArbitrageRatio = grossArbitrageRatio * feeMultiplier;
  const netProfitBps = Math.round((netArbitrageRatio - 1.0) * 10_000);
  const isProfitable = netProfitBps > 0;

  return {
    poolName: params.poolName,
    tokenA: params.tokenA,
    tokenB: params.tokenB,
    tokenC: params.tokenC,
    rateAB: params.rateAB,
    rateBC: params.rateBC,
    rateCA: params.rateCA,
    grossArbitrageRatio: Math.round(grossArbitrageRatio * 10_000) / 10_000,
    netProfitBps,
    isProfitable,
  };
}

/**
 * Executes an arbitrage trade, distributing 70% of profit to customer dividend pools
 */
export function executeArbitrageTrade(
  opportunity: TriangularOpportunity,
  notionalAmountCents: number,
  pool: HftArbitragePool,
): ArbitrageExecutionResult {
  if (pool.isCircuitBreakerActive) {
    return {
      poolName: pool.poolName,
      notionalAmountCents,
      grossProfitCents: 0,
      retainedReservesCents: 0,
      customerDividendCents: 0,
      slippageBps: 0,
      executionSucceeded: false,
      circuitBreakerTripped: true,
    };
  }

  if (!opportunity.isProfitable || notionalAmountCents <= 0) {
    return {
      poolName: pool.poolName,
      notionalAmountCents,
      grossProfitCents: 0,
      retainedReservesCents: 0,
      customerDividendCents: 0,
      slippageBps: 0,
      executionSucceeded: false,
      circuitBreakerTripped: false,
    };
  }

  // Calculate profit in cents
  const profitFraction = opportunity.netProfitBps / 10_000;
  const grossProfitCents = Math.round(notionalAmountCents * profitFraction);
  const customerDividendCents = Math.round(grossProfitCents * 0.7); // 70% to customer dividend
  const retainedReservesCents = grossProfitCents - customerDividendCents; // 30% retained

  const simulatedSlippageBps = Math.min(pool.maxSlippageBps, 1);

  return {
    poolName: pool.poolName,
    notionalAmountCents,
    grossProfitCents,
    retainedReservesCents,
    customerDividendCents,
    slippageBps: simulatedSlippageBps,
    executionSucceeded: true,
    circuitBreakerTripped: false,
  };
}
