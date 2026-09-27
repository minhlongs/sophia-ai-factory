'use server';

/**
 * hectocorn-compute-actions.ts — Gate 12 Land Layer Server Actions
 * Hectocorn GPU Render Dispatch & Arbitrage Execution Actions
 */

import { getD1 } from '@/seed/db/client';
import {
  planRenderBatchDispatch,
  evaluateSevenNinesSla,
} from '@/tree/compute/hectocorn-compute-grid';
import {
  detectTriangularArbitrage,
  executeArbitrageTrade,
} from '@/tree/arbitrage/high-frequency-arbitrage-engine';
import type {
  HectocornComputeNode,
  HftArbitragePool,
} from '@/seed/types/hectocorn-compute';

export async function dispatchRenderBatchAction(
  batchId: string,
  totalRenders: number,
  nodes: HectocornComputeNode[],
) {
  try {
    const plan = planRenderBatchDispatch(batchId, totalRenders, nodes);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO distributed_render_batches (
            id, batch_id, total_renders, completed_renders, failed_renders,
            allocated_nodes_count, average_render_time_ms, status, started_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `batch_${batchId}`,
          batchId,
          totalRenders,
          0,
          0,
          plan.allocations.length,
          4200,
          'PROCESSING',
          new Date().toISOString(),
        )
        .run();
    }

    return {
      success: true,
      data: plan,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function triggerHftArbitrageAction(params: {
  pool: HftArbitragePool;
  notionalAmountCents: number;
  rateAB: number;
  rateBC: number;
  rateCA: number;
}) {
  try {
    const opportunity = detectTriangularArbitrage({
      poolName: params.pool.poolName,
      tokenA: 'USDT',
      tokenB: 'USDC',
      tokenC: 'USD',
      rateAB: params.rateAB,
      rateBC: params.rateBC,
      rateCA: params.rateCA,
    });

    const execution = executeArbitrageTrade(
      opportunity,
      params.notionalAmountCents,
      params.pool,
    );

    const db = await getD1();
    if (db && execution.executionSucceeded) {
      await db
        .prepare(
          `UPDATE hft_arbitrage_pools
           SET rebalanced_volume_24h_cents = rebalanced_volume_24h_cents + ?,
               arbitrage_yield_captured_cents = arbitrage_yield_captured_cents + ?,
               customer_dividend_distributed_cents = customer_dividend_distributed_cents + ?,
               last_arbitrage_execution_at = ?
           WHERE id = ?`,
        )
        .bind(
          params.notionalAmountCents,
          execution.grossProfitCents,
          execution.customerDividendCents,
          new Date().toISOString(),
          params.pool.id,
        )
        .run();
    }

    return {
      success: true,
      data: {
        opportunity,
        execution,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
