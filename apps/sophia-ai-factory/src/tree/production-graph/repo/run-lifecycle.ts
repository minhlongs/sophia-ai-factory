/**
 * @file run-lifecycle.ts
 * @description Terminal transitions (complete, fail, cancel) for production graph runs.
 * @layer tree
 */

import { createServerClient } from '@/seed/db/client';
import { failure, success, type Result } from '@/seed/types/result';
import type {
  ProductionGraphRunError,
  ProductionGraphRunStatus,
} from '@/seed/types/production-factory';
import { logger } from '@/seed/utils/logger-utility';
import { toErrorCode } from './mappers';
import type { GraphRepoError } from './types';

/**
 * Terminal success transition: sets status/phase, output, and cost totals,
 * and stamps ended_at. Guarded on `expectedStatus`.
 */
export async function completeRun(
  runId: string,
  expectedStatus: ProductionGraphRunStatus,
  output: { outputJson: string | null; totalCostCents: number; totalTokens: number },
): Promise<Result<{ flipped: boolean }, GraphRepoError>> {
  try {
    const d1 = createServerClient();
    const nowMs = Date.now();
    const result = await d1
      .prepare(
        'UPDATE production_graph_runs SET status = ?1, phase = ?2, output_json = ?3, ' +
        'total_cost_cents = ?4, total_tokens = ?5, ended_at = ?6 ' +
        'WHERE id = ?7 AND status = ?8',
      )
      .bind(
        'completed',
        'review',
        output.outputJson,
        output.totalCostCents,
        output.totalTokens,
        nowMs,
        runId,
        expectedStatus,
      )
      .run();

    return success({ flipped: (result.meta?.changes ?? 0) > 0 });
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] completeRun failed', { error: message, runId });
    return failure({ code, message });
  }
}

/**
 * Terminal failure transition: sets status/phase, structured error, and cost
 * totals, and stamps ended_at. Guarded on `expectedStatus`.
 */
export async function failRun(
  runId: string,
  expectedStatus: ProductionGraphRunStatus,
  error: ProductionGraphRunError,
  totals: { totalCostCents: number; totalTokens: number },
): Promise<Result<{ flipped: boolean }, GraphRepoError>> {
  try {
    const d1 = createServerClient();
    const nowMs = Date.now();
    const result = await d1
      .prepare(
        'UPDATE production_graph_runs SET status = ?1, phase = ?2, error_json = ?3, ' +
        'error_message = ?4, total_cost_cents = ?5, total_tokens = ?6, ended_at = ?7 ' +
        'WHERE id = ?8 AND status = ?9',
      )
      .bind(
        'failed',
        'executing',
        JSON.stringify(error),
        error.message ?? error.code,
        totals.totalCostCents,
        totals.totalTokens,
        nowMs,
        runId,
        expectedStatus,
      )
      .run();

    return success({ flipped: (result.meta?.changes ?? 0) > 0 });
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] failRun failed', { error: message, runId });
    return failure({ code, message });
  }
}

/**
 * Terminal cancellation transition: sets status to 'cancelled', stamps ended_at,
 * and records cancellation reason. Guarded on `expectedStatus` (only flips when
 * the run is still in a cancellable state: queued, running, awaiting_approval).
 */
export async function cancelProductionGraphRun(
  runId: string,
  expectedStatus: ProductionGraphRunStatus,
  reason?: string,
): Promise<Result<{ flipped: boolean }, GraphRepoError>> {
  try {
    const d1 = createServerClient();
    const nowMs = Date.now();
    const error: ProductionGraphRunError = {
      code: 'CANCELLED',
      message: reason ?? 'Cancelled by user',
      details: { cancelledAt: nowMs },
    };
    const result = await d1
      .prepare(
        'UPDATE production_graph_runs SET status = ?1, phase = ?2, error_json = ?3, ' +
        'error_message = ?4, ended_at = ?5 ' +
        'WHERE id = ?6 AND status = ?7',
      )
      .bind(
        'cancelled',
        'cancelled',
        JSON.stringify(error),
        error.message,
        nowMs,
        runId,
        expectedStatus,
      )
      .run();

    return success({ flipped: (result.meta?.changes ?? 0) > 0 });
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] cancelProductionGraphRun failed', { error: message, runId });
    return failure({ code, message });
  }
}
