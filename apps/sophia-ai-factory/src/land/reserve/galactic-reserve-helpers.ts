/**
 * @file galactic-reserve-helpers.ts
 * @layer land/reserve
 * @description Types and D1 persistence helpers for Galactic Reserve actions.
 */

import { getD1 } from '@/seed/db/client';
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

export async function recordStabilizationEventIfNeeded(params: {
  amountCents: number;
  requiredOperation: ReserveOperationType;
  reserveBackingRatioBps: number;
  targetHealthFactor: number;
}): Promise<void> {
  const db = await getD1();
  if (db && params.amountCents > 0) {
    const eventRef = `STABILIZE_${Date.now()}`;
    await db
      .prepare(
        `INSERT INTO reserve_stabilization_events (id, event_ref, operation_type, currency, amount_cents, pre_stabilization_backing_bps, post_stabilization_backing_bps, clearing_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `evt_${eventRef}`,
        eventRef,
        params.requiredOperation,
        'SSDR',
        params.amountCents,
        params.reserveBackingRatioBps,
        Math.round(params.targetHealthFactor * 10000),
        `hash_${eventRef}`,
        'COMMITTED'
      )
      .run();
  }
}
