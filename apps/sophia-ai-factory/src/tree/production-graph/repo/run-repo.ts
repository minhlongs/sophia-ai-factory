/**
 * @file run-repo.ts
 * @description Production graph run creation, lookup, and checkpointing.
 * @layer tree
 */

import { createServerClient } from '@/seed/db/client';
import { failure, success, type Result } from '@/seed/types/result';
import type {
  ProductionGraphNodeState,
  ProductionGraphRun,
  ProductionGraphRunPhase,
  ProductionGraphRunStatus,
} from '@/seed/types/production-factory';
import { logger } from '@/seed/utils/logger-utility';
import { RUN_COLUMNS, toErrorCode, toRun } from './mappers';
import type { CreateRunInput, GraphRepoError, RunRow } from './types';

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
  const run = await getRun(runId);
  if (!run.ok) return failure(run.error);
  if (!run.value) {
    return failure({ code: 'NOT_FOUND', message: `Run ${runId} not found` });
  }
  return success(run.value.nodeStates);
}
