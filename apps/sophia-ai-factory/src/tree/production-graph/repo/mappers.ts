/**
 * @file mappers.ts
 * @description Row mapping and parsing helpers for production graph repository.
 * @layer tree
 */

import type {
  GraphDefinition,
  ProductionGraph,
  ProductionGraphNodeState,
  ProductionGraphRun,
  ProductionGraphRunPhase,
  ProductionGraphRunStatus,
} from '@/seed/types/production-factory';
import type { GraphRepoError, GraphRow, RunRow } from './types';

export function toErrorCode(err: unknown): { code: GraphRepoError['code']; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('not available') || message.includes('binding')) {
    return { code: 'DB_UNAVAILABLE', message };
  }
  if (message.includes('UNIQUE constraint failed')) {
    return { code: 'CONFLICT', message };
  }
  return { code: 'DB_ERROR', message };
}

export function parseDefinition(json: string): GraphDefinition | null {
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

export function parseNodeStates(json: string | null): ProductionGraphNodeState[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ProductionGraphNodeState[]) : null;
  } catch {
    return null;
  }
}

export function toGraph(row: GraphRow): ProductionGraph | null {
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

export function toRun(row: RunRow): ProductionGraphRun {
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

export const GRAPH_COLUMNS =
  'id, workspace_id, mission_type, slug, name, definition_json, is_template, created_at, updated_at';

export const RUN_COLUMNS =
  'id, graph_id, mission_id, workspace_id, status, phase, node_states_json, output_json, ' +
  'error_json, error_message, total_cost_cents, total_tokens, retry_count, created_at, started_at, ended_at';
