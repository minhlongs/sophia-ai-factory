/**
 * @file graph-repo.ts
 * @description Production graph definitions CRUD operations.
 * @layer tree
 */

import { createServerClient } from '@/seed/db/client';
import { failure, success, type Result } from '@/seed/types/result';
import type { ProductionGraph } from '@/seed/types/production-factory';
import { logger } from '@/seed/utils/logger-utility';
import { GRAPH_COLUMNS, toErrorCode, toGraph } from './mappers';
import type { GraphRepoError, GraphRow } from './types';
export { createGraph } from './graph-repo-writer';

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
