/**
 * Autonomy Configuration Repository
 *
 * Persistence for workspace-level and per-agent-type autonomy settings.
 * Layer: tree (domain-specific reusable).
 *
 * @module tree/autonomy
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export interface AutonomyConfig {
  id: string;
  workspaceId: string;
  agentType: string;
  level: AutonomyLevel;
  overrides: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export type AutonomyRepoError =
  | { code: 'DB_UNAVAILABLE'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'DB_ERROR'; message: string };

const DEFAULT_LEVEL: AutonomyLevel = 1;
const DEFAULT_OVERRIDES: Record<string, unknown> = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseOverrides(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return { ...DEFAULT_OVERRIDES };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { ...DEFAULT_OVERRIDES };
  } catch {
    return { ...DEFAULT_OVERRIDES };
  }
}

function toErrorCode(err: unknown): { code: AutonomyRepoError['code']; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('not available') || message.includes('binding')) {
    return { code: 'DB_UNAVAILABLE', message };
  }
  return { code: 'DB_ERROR', message };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
      .first<{
        id: string;
        workspace_id: string;
        agent_type: string;
        level: number;
        overrides_json: string | null;
        created_at: number;
        updated_at: number;
      }>();

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
        .first<{
          id: string;
          workspace_id: string;
          agent_type: string;
          level: number;
          overrides_json: string | null;
          created_at: number;
          updated_at: number;
        }>();

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
    logger.error('[AutonomyRepo] getAutonomyConfig failed', { error: message, workspaceId, agentType });
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
    logger.error('[AutonomyRepo] setAutonomyLevel failed', { error: message, workspaceId, level, agentType });
    return failure({ code, message });
  }
}

/**
 * Determine whether an action type is permitted under the current config.
 *
 * Rules:
 * - 0 (Manual): always false
 * - 1 (Suggest): always false (agent only proposes)
 * - 2 (Semi-auto): allow low-risk actions (informational, read-only)
 * - 3 (Auto): allow all routine actions; block high-risk (spend, delete)
 * - 4 (Full): always true
 */
export async function isActionAllowed(
  workspaceId: string,
  actionType: string,
  agentType = 'global',
): Promise<boolean> {
  const configResult = await getAutonomyConfig(workspaceId, agentType);
  if (!configResult.ok) {
    logger.warn('[AutonomyRepo] isActionAllowed falling back to level 0 (deny)', {
      error: configResult.error,
      workspaceId,
      actionType,
      agentType,
    });
    return false;
  }

  const level = configResult.value.level;

  switch (level) {
    case 0:
      return false;
    case 1:
      return false;
    case 2: {
      const readOnlyActions = new Set([
        'read_mission',
        'list_approvals',
        'get_status',
        'fetch_metrics',
        'read_logs',
      ]);
      return readOnlyActions.has(actionType);
    }
    case 3: {
      const blockedActions = new Set([
        'spend_credits',
        'delete_mission',
        'update_billing',
        'revoke_credentials',
        'webhook_deregister',
      ]);
      return !blockedActions.has(actionType);
    }
    case 4:
      return true;
    default:
      return false;
  }
}