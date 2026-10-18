/**
 * @file graph-repo-writer.ts
 * @description Production graph write operations (INSERT + verification).
 * @layer tree
 */

import { createServerClient } from '@/seed/db/client';
import { failure, success, type Result } from '@/seed/types/result';
import type { ProductionGraph } from '@/seed/types/production-factory';
import { logger } from '@/seed/utils/logger-utility';
import { toErrorCode } from './mappers';
import { getGraphBySlug } from './graph-repo';
import type { CreateGraphInput, GraphRepoError } from './types';

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
