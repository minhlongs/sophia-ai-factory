/**
 * @file run-node-states-repo.ts
 * @description Per-node checkpoint state persistence and retrieval for production graph runs.
 * @layer tree
 */

import { createServerClient } from '@/seed/db/client';
import { failure, success, type Result } from '@/seed/types/result';
import type { ProductionGraphNodeState } from '@/seed/types/production-factory';
import { logger } from '@/seed/utils/logger-utility';
import { RUN_COLUMNS, toErrorCode, toRun } from './mappers';
import type { GraphRepoError, RunRow } from './types';

/**
 * Persist the per-node checkpoint states for resume.
 */
export async function setNodeStates(
  runId: string,
  states: readonly ProductionGraphNodeState[],
): Promise<Result<void, GraphRepoError>> {
  try {
    const d1 = createServerClient();
    await d1
      .prepare('UPDATE production_graph_runs SET node_states_json = ?1 WHERE id = ?2')
      .bind(JSON.stringify(states), runId)
      .run();
    return success(undefined);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] setNodeStates failed', { error: message, runId });
    return failure({ code, message });
  }
}

/**
 * Read the persisted per-node checkpoint states. Returns success(null) when
 * the run has no checkpoint yet.
 */
export async function getNodeStates(
  runId: string,
): Promise<Result<ProductionGraphNodeState[] | null, GraphRepoError>> {
  try {
    const d1 = createServerClient();
    const row = await d1
      .prepare(`SELECT ${RUN_COLUMNS} FROM production_graph_runs WHERE id = ?1`)
      .bind(runId)
      .first<RunRow>();

    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `Run ${runId} not found` });
    }
    return success(toRun(row).nodeStates);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] getRun failed', { error: message, runId });
    return failure({ code, message });
  }
}
