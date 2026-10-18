/**
 * @file run-repo.ts
 * @description Production graph run creation, lookup, and checkpointing.
 * @layer tree
 */

import { createServerClient } from '@/seed/db/client';
import { failure, success, type Result } from '@/seed/types/result';
import type {
  ProductionGraphRun,
  ProductionGraphRunPhase,
  ProductionGraphRunStatus,
} from '@/seed/types/production-factory';
import { logger } from '@/seed/utils/logger-utility';
import { RUN_COLUMNS, toErrorCode, toRun } from './mappers';
import type { CreateRunInput, GraphRepoError, RunRow } from './types';
export { getNodeStates, setNodeStates } from './run-node-states-repo';

/**
 * Create a run row in 'queued'/'planning' state.
 */
export async function createRun(
  workspaceId: string,
  input: CreateRunInput,
): Promise<Result<ProductionGraphRun, GraphRepoError>> {
  try {
    if (!input.id || !input.graphId || !input.missionId) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'Run id, graphId, and missionId are all required',
      });
    }
    const retryCount = input.retryCount ?? 0;
    if (!Number.isInteger(retryCount) || retryCount < 0) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: `Invalid retryCount: ${retryCount}. Must be a non-negative integer.`,
      });
    }

    const d1 = createServerClient();
    const nowMs = Date.now();
    await d1
      .prepare(
        'INSERT INTO production_graph_runs ' +
        '(id, graph_id, mission_id, workspace_id, status, phase, retry_count, created_at) ' +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
      )
      .bind(input.id, input.graphId, input.missionId, workspaceId, 'queued', 'planning', retryCount, nowMs)
      .run();

    const stored = await getRun(input.id);
    if (!stored.ok) return failure(stored.error);
    if (!stored.value) {
      return failure({ code: 'DB_ERROR', message: 'Run write did not persist' });
    }
    return success(stored.value);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] createRun failed', { error: message, workspaceId, runId: input.id });
    return failure({ code, message });
  }
}

/**
 * Fetch a run by primary key. Returns success(null) when absent.
 */
export async function getRun(
  runId: string,
): Promise<Result<ProductionGraphRun | null, GraphRepoError>> {
  try {
    const d1 = createServerClient();
    const row = await d1
      .prepare(`SELECT ${RUN_COLUMNS} FROM production_graph_runs WHERE id = ?1`)
      .bind(runId)
      .first<RunRow>();

    return success(row ? toRun(row) : null);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] getRun failed', { error: message, runId });
    return failure({ code, message });
  }
}

/**
 * Guarded status transition: only flips when the current status matches
 * `expectedStatus`. Returns flipped=false when the row moved on (stale
 * writer lost the race) — never throws.
 */
export async function updateRunStatus(
  runId: string,
  expectedStatus: ProductionGraphRunStatus,
  nextStatus: ProductionGraphRunStatus,
  phase: ProductionGraphRunPhase,
): Promise<Result<{ flipped: boolean }, GraphRepoError>> {
  try {
    const d1 = createServerClient();
    const result = await d1
      .prepare(
        'UPDATE production_graph_runs SET status = ?1, phase = ?2 ' +
        'WHERE id = ?3 AND status = ?4',
      )
      .bind(nextStatus, phase, runId, expectedStatus)
      .run();

    return success({ flipped: (result.meta?.changes ?? 0) > 0 });
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] updateRunStatus failed', { error: message, runId, nextStatus });
    return failure({ code, message });
  }
}
