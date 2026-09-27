'use server';

/**
 * @file galactic-reserve-actions.ts
 * @layer land/reserve
 * @description Land layer Server Actions for Central Bank Swap Lines and sSDR Reserve Vault.
 */

import { getD1 } from '@/seed/db/client';
import { calculateSwapExecution, validateSwapLineDraw } from '@/tree/reserve/central-bank-swap-engine';
import {
  calculateSsdrBasketIndex,
  evaluateGalacticBuffersHealth,
  generateStabilizationAdvice,
} from '@/tree/reserve/ssdr-basket-engine';
import type {
  SovereignSwapLine,
  SwapExecutionRequest,
  SwapExecutionResult,
  SsdrCurrencyBasket,
  SsdrValuationQuote,
  GalacticLiquidityBuffer,
  ReserveOperationType,
} from '@/seed/types/galactic-reserve';

export interface ExecuteSwapActionParams {
  swapLine: SovereignSwapLine;
  request: SwapExecutionRequest;
  spotRate: number;
  quoteInterestRateBps: number;
}

export interface SwapActionResult {
  success: boolean;
  result?: SwapExecutionResult;
  error?: string;
}

export async function executeSovereignSwapAction(
  params: ExecuteSwapActionParams
): Promise<SwapActionResult> {
  try {
    const validation = validateSwapLineDraw(params.swapLine, params.request.drawAmountCents);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    const result = calculateSwapExecution(
      params.swapLine,
      params.request,
      params.spotRate,
      params.quoteInterestRateBps
    );

    const db = await getD1();
    if (db) {
      await db
        .prepare(
          `UPDATE sovereign_swap_lines
           SET drawn_amount_cents = drawn_amount_cents + ?
           WHERE line_code = ?`
        )
        .bind(params.request.drawAmountCents, params.swapLine.lineCode)
        .run();
    }

    return { success: true, result };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export interface RebalanceReserveActionParams {
  basket: SsdrCurrencyBasket;
  quotes: SsdrValuationQuote;
  buffers: GalacticLiquidityBuffer[];
}

export interface RebalanceReserveActionResult {
  success: boolean;
  basketValuation?: {
    calculatedIndexCents: number;
    impliedMarketCapCents: number;
    isSolvent: boolean;
  };
  bufferStatus?: {
    totalAvailableCents: number;
    overallHealthFactor: number;
    isTargetMet: boolean;
  };
  recommendedOperation?: ReserveOperationType;
  error?: string;
}

export async function rebalanceSsdrReserveAction(
  params: RebalanceReserveActionParams
): Promise<RebalanceReserveActionResult> {
  try {
    const valuation = calculateSsdrBasketIndex(params.basket, params.quotes);
    const bufferHealth = evaluateGalacticBuffersHealth(params.buffers);
    const advice = generateStabilizationAdvice(
      valuation.reserveBackingRatioBps,
      bufferHealth.overallHealthFactor,
      bufferHealth.deficitCents
    );

    const db = await getD1();
    if (db && advice.amountCents > 0) {
      const eventRef = `STABILIZE_${Date.now()}`;
      await db
        .prepare(
          `INSERT INTO reserve_stabilization_events (
             id, event_ref, operation_type, currency, amount_cents,
             pre_stabilization_backing_bps, post_stabilization_backing_bps,
             clearing_hash, status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `evt_${eventRef}`,
          eventRef,
          advice.requiredOperation,
          'SSDR',
          advice.amountCents,
          valuation.reserveBackingRatioBps,
          Math.round(advice.targetHealthFactor * 10000),
          `hash_${eventRef}`,
          'COMMITTED'
        )
        .run();
    }

    return {
      success: true,
      basketValuation: {
        calculatedIndexCents: valuation.calculatedIndexCents,
        impliedMarketCapCents: valuation.impliedMarketCapCents,
        isSolvent: valuation.isSolvent,
      },
      bufferStatus: {
        totalAvailableCents: bufferHealth.totalAvailableCents,
        overallHealthFactor: bufferHealth.overallHealthFactor,
        isTargetMet: bufferHealth.isTargetMet,
      },
      recommendedOperation: advice.requiredOperation,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
