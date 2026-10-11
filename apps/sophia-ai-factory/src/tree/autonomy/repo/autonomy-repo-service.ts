/**
 * Autonomy Repository Service
 *
 * Persistence for workspace-level and per-agent-type autonomy settings.
 * Layer: tree (domain-specific reusable).
 *
 * @module tree/autonomy/repo/autonomy-repo-service
 */

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import {
  type AutonomyConfig,
  type AutonomyLevel,
  type AutonomyRepoError,
  DEFAULT_LEVEL,
  DEFAULT_OVERRIDES,
} from './types';
import { parseOverrides, toErrorCode, logRepoError, logRepoWarn } from './execution-logger';
import { checkActionAllowed } from './policy-queries';

interface AutonomyD1Row {
  id: string;
  workspace_id: string;
  agent_type: string;
  level: number;
  overrides_json: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Fetch autonomy config for a workspace + optional agent type.
 * Falls back to global config when agent-specific config does not exist.
 * Returns built-in default (level 1) when nothing is stored.
 */
export async function getAutonomyConfig(
  workspaceId: string,
  agentType = 'global',
): Promise<Result<AutonomyConfig, AutonomyRepoError>> {
  try {
    const d1 = await getD1();
    if (!d1) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database binding not available' });

    const row = await d1
      .prepare(
        'SELECT id, workspace_id, agent_type, level, overrides_json, created_at, updated_at ' +
        'FROM autonomy_configs WHERE workspace_id = ?1 AND agent_type = ?2',
      )
      .bind(workspaceId, agentType)
      .first<AutonomyD1Row>();

    if (row) {
      return success({
        id: row.id,
        workspaceId: row.workspace_id,
        agentType: row.agent_type,
        level: row.level as AutonomyLevel,
        overrides: parseOverrides(row.overrides_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    // Fallback: global config for workspace
    if (agentType !== 'global') {
      const globalRow = await d1
        .prepare(
          'SELECT id, workspace_id, agent_type, level, overrides_json, created_at, updated_at ' +
          'FROM autonomy_configs WHERE workspace_id = ?1 AND agent_type = \'global\'',
        )
        .bind(workspaceId)
        .first<AutonomyD1Row>();

      if (globalRow) {
        return success({
          id: globalRow.id,
          workspaceId: globalRow.workspace_id,
          agentType: 'global',
          level: globalRow.level as AutonomyLevel,
          overrides: parseOverrides(globalRow.overrides_json),
          createdAt: globalRow.created_at,
          updatedAt: globalRow.updated_at,
        });
      }
    }

    // Built-in default
    return success({
      id: `default-${workspaceId}-${agentType}`,
      workspaceId,
      agentType: agentType as AutonomyConfig['agentType'],
      level: DEFAULT_LEVEL,
      overrides: { ...DEFAULT_OVERRIDES },
      createdAt: 0,
      updatedAt: 0,
    });
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logRepoError('getAutonomyConfig', message, { workspaceId, agentType });
    return failure({ code, message });
  }
}

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

/**
 * Determine whether an action type is permitted under the current config.
 */
export async function isActionAllowed(
  workspaceId: string,
  actionType: string,
  agentType = 'global',
): Promise<boolean> {
  const configResult = await getAutonomyConfig(workspaceId, agentType);
  if (!configResult.ok) {
    logRepoWarn('isActionAllowed falling back to level 0 (deny)', {
      error: configResult.error,
      workspaceId,
      actionType,
      agentType,
    });
    return false;
  }

  return checkActionAllowed(configResult.value.level, actionType);
}
