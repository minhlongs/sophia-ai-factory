/**
 * Autonomy Repository Mutations
 *
 * Handles persistence updates for workspace-level and per-agent-type autonomy settings.
 * Layer: tree (domain-specific reusable).
 *
 * @module tree/autonomy/repo/autonomy-repo-mutations
 */

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import {
  type AutonomyRepoError,
  DEFAULT_OVERRIDES,
} from './types';
import { toErrorCode, logRepoError } from './execution-logger';

/**
 * Set autonomy level for a workspace + optional agent type.
 * Upserts via INSERT OR REPLACE.
 */
export async function setAutonomyLevel(
  workspaceId: string,
  level: number,
  agentType = 'global',
): Promise<Result<void, AutonomyRepoError>> {
  try {
    if (level < 0 || level > 4) {
      return failure({ code: 'DB_ERROR', message: `Invalid autonomy level: ${level}. Must be 0-4.` });
    }

    const d1 = await getD1();
    if (!d1) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database binding not available' });

    const id = `${workspaceId}:${agentType}`;
    const overridesJson = JSON.stringify(DEFAULT_OVERRIDES);

    await d1
      .prepare(
        'INSERT INTO autonomy_configs (id, workspace_id, agent_type, level, overrides_json, created_at, updated_at) ' +
        'VALUES (?1, ?2, ?3, ?4, ?5, COALESCE((SELECT created_at FROM autonomy_configs WHERE id = ?1), unixepoch()), unixepoch())',
      )
      .bind(id, workspaceId, agentType, level, overridesJson)
      .run();

    return success(undefined);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logRepoError('setAutonomyLevel', message, { workspaceId, level, agentType });
    return failure({ code, message });
  }
}
