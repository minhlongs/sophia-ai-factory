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
import {
  recordStabilizationEventIfNeeded,
  type ExecuteSwapActionParams,
  type SwapActionResult,
  type RebalanceReserveActionParams,
  type RebalanceReserveActionResult,
} from './galactic-reserve-helpers';

export type {
  ExecuteSwapActionParams,
  SwapActionResult,
  RebalanceReserveActionParams,
  RebalanceReserveActionResult,
} from './galactic-reserve-helpers';

export async function executeSovereignSwapAction(
  params: ExecuteSwapActionParams
): Promise<SwapActionResult> {
  try {
    const validation = validateSwapLineDraw(params.swapLine, params.request.drawAmountCents);
    if (!validation.valid) return { success: false, error: validation.reason };

    const result = calculateSwapExecution(
      params.swapLine,
      params.request,
      params.spotRate,
      params.quoteInterestRateBps
    );

    const db = await getD1();
    if (db) {
      await db
        .prepare(`UPDATE sovereign_swap_lines SET drawn_amount_cents = drawn_amount_cents + ? WHERE line_code = ?`)
        .bind(params.request.drawAmountCents, params.swapLine.lineCode)
        .run();
    }

    return { success: true, result };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
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

    await recordStabilizationEventIfNeeded({
      amountCents: advice.amountCents,
      requiredOperation: advice.requiredOperation,
      reserveBackingRatioBps: valuation.reserveBackingRatioBps,
      targetHealthFactor: advice.targetHealthFactor,
    });

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
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
