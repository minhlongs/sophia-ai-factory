/**
 * @file run-cancel.ts
 * @description Terminal cancellation transition for production graph runs.
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
