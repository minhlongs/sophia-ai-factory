/**
 * Production Graph Repository
 *
 * Persistence for production graph definitions and runs backed by the
 * `production_graphs` / `production_graph_runs` tables (migration 0257).
 * Uses the synchronous `createServerClient()` accessor — never awaited —
 * matching the canonical D1 access pattern (see tree/autonomy/policy-repo).
 *
 * Layer: tree (domain-specific reusable).
 *
 * @module tree/production-graph/repo
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  GraphDefinition,
  ProductionGraph,
  ProductionGraphNodeState,
  ProductionGraphRun,
  ProductionGraphRunError,
  ProductionGraphRunPhase,
  ProductionGraphRunStatus,
} from '@/seed/types/production-factory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GraphRepoError =
  | { code: 'DB_UNAVAILABLE'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'CONFLICT'; message: string }
  | { code: 'DB_ERROR'; message: string };

/** Writable fields for creating a production graph. */
export interface CreateGraphInput {
  id: string;
  missionType: string;
  slug: string;
  name: string;
  definition: GraphDefinition;
  isTemplate: boolean;
}

/** Writable fields for creating a production graph run. */
export interface CreateRunInput {
  id: string;
  graphId: string;
  missionId: string;
  retryCount?: number;
}

/** Raw snake_case row shapes returned by D1. */
interface GraphRow {
  id: string;
  workspace_id: string;
  mission_type: string;
  slug: string;
  name: string;
  definition_json: string;
  is_template: number;
  created_at: number;
  updated_at: number;
}

interface RunRow {
  id: string;
  graph_id: string;
  mission_id: string;
  workspace_id: string;
  status: string;
  phase: string;
  node_states_json: string | null;
  output_json: string | null;
  error_json: string | null;
  error_message: string | null;
  total_cost_cents: number;
  total_tokens: number;
  retry_count: number;
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toErrorCode(err: unknown): { code: GraphRepoError['code']; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('not available') || message.includes('binding')) {
    return { code: 'DB_UNAVAILABLE', message };
  }
  if (message.includes('UNIQUE constraint failed')) {
    return { code: 'CONFLICT', message };
  }
  return { code: 'DB_ERROR', message };
}

function parseDefinition(json: string): GraphDefinition | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as { nodes?: unknown }).nodes) ||
      !Array.isArray((parsed as { edges?: unknown }).edges)
    ) {
      return null;
    }
    return parsed as GraphDefinition;
  } catch {
    return null;
  }
}

function parseNodeStates(json: string | null): ProductionGraphNodeState[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ProductionGraphNodeState[]) : null;
  } catch {
    return null;
  }
}

function toGraph(row: GraphRow): ProductionGraph | null {
  const definition = parseDefinition(row.definition_json);
  if (!definition) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    missionType: row.mission_type,
    slug: row.slug,
    name: row.name,
    definition,
    isTemplate: row.is_template === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRun(row: RunRow): ProductionGraphRun {
  return {
    id: row.id,
    graphId: row.graph_id,
    missionId: row.mission_id,
    workspaceId: row.workspace_id,
    status: row.status as ProductionGraphRunStatus,
    phase: row.phase as ProductionGraphRunPhase,
    nodeStates: parseNodeStates(row.node_states_json),
    outputJson: row.output_json,
    errorJson: row.error_json,
    errorMessage: row.error_message,
    totalCostCents: row.total_cost_cents,
    totalTokens: row.total_tokens,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

const GRAPH_COLUMNS =
  'id, workspace_id, mission_type, slug, name, definition_json, is_template, created_at, updated_at';

const RUN_COLUMNS =
  'id, graph_id, mission_id, workspace_id, status, phase, node_states_json, output_json, ' +
  'error_json, error_message, total_cost_cents, total_tokens, retry_count, created_at, started_at, ended_at';

// ---------------------------------------------------------------------------
// Graph CRUD
// ---------------------------------------------------------------------------

/**
 * Fetch a graph by workspace + slug. Returns success(null) when absent.
 */
export async function getGraphBySlug(
  workspaceId: string,
  slug: string,
): Promise<Result<ProductionGraph | null, GraphRepoError>> {
  try {
    const d1 = createServerClient();
    const row = await d1
      .prepare(`SELECT ${GRAPH_COLUMNS} FROM production_graphs WHERE workspace_id = ?1 AND slug = ?2`)
      .bind(workspaceId, slug)
      .first<GraphRow>();

    if (!row) return success(null);
    const graph = toGraph(row);
    if (!graph) {
      return failure({ code: 'DB_ERROR', message: `Graph ${slug} has corrupt definition_json` });
    }
    return success(graph);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] getGraphBySlug failed', { error: message, workspaceId, slug });
    return failure({ code, message });
  }
}

/**
 * Fetch a graph by primary key. Returns success(null) when absent.
 */
export async function getGraphById(
  graphId: string,
): Promise<Result<ProductionGraph | null, GraphRepoError>> {
  try {
    const d1 = createServerClient();
    const row = await d1
      .prepare(`SELECT ${GRAPH_COLUMNS} FROM production_graphs WHERE id = ?1`)
      .bind(graphId)
      .first<GraphRow>();

    if (!row) return success(null);
    const graph = toGraph(row);
    if (!graph) {
      return failure({ code: 'DB_ERROR', message: `Graph ${graphId} has corrupt definition_json` });
    }
    return success(graph);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] getGraphById failed', { error: message, graphId });
    return failure({ code, message });
  }
}

/**
 * List template graphs for a workspace, ordered by slug.
 */
export async function listTemplates(
  workspaceId: string,
): Promise<Result<ProductionGraph[], GraphRepoError>> {
  try {
    const d1 = createServerClient();
    const res = await d1
      .prepare(
        `SELECT ${GRAPH_COLUMNS} FROM production_graphs ` +
        'WHERE workspace_id = ?1 AND is_template = 1 ORDER BY slug ASC',
      )
      .bind(workspaceId)
      .all<GraphRow>();

    const graphs: ProductionGraph[] = [];
    for (const row of res.results ?? []) {
      const graph = toGraph(row);
      if (graph) graphs.push(graph);
    }
    return success(graphs);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] listTemplates failed', { error: message, workspaceId });
    return failure({ code, message });
  }
}

/**
 * Create a graph. Fails with CONFLICT when the (workspace_id, slug) pair
 * already exists — callers wanting idempotency should read first.
 */
export async function createGraph(
  workspaceId: string,
  input: CreateGraphInput,
): Promise<Result<ProductionGraph, GraphRepoError>> {
  try {
    if (!input.id || !input.slug || !input.name || !input.missionType) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'Graph id, slug, name, and missionType are all required',
      });
    }
    if (input.definition.nodes.length === 0) {
      return failure({ code: 'VALIDATION_ERROR', message: 'Graph definition has no nodes' });
    }

    const d1 = createServerClient();
    const nowMs = Date.now();
    await d1
      .prepare(
        'INSERT INTO production_graphs ' +
        '(id, workspace_id, mission_type, slug, name, definition_json, is_template, created_at, updated_at) ' +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
      )
      .bind(
        input.id,
        workspaceId,
        input.missionType,
        input.slug,
        input.name,
        JSON.stringify(input.definition),
        input.isTemplate ? 1 : 0,
        nowMs,
        nowMs,
      )
      .run();

    const stored = await getGraphBySlug(workspaceId, input.slug);
    if (!stored.ok) return failure(stored.error);
    if (!stored.value) {
      return failure({ code: 'DB_ERROR', message: 'Graph write did not persist' });
    }
    return success(stored.value);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[GraphRepo] createGraph failed', { error: message, workspaceId, slug: input.slug });
    return failure({ code, message });
  }
}

// ---------------------------------------------------------------------------
// Run CRUD
// ---------------------------------------------------------------------------

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
