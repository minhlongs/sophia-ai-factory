/**
 * Autonomy Policy Read Operations
 *
 * Layer: tree/autonomy
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { MissionTypePolicy } from '@/seed/types/production-factory';
import {
  type PolicyRepoError,
  type PolicyRow,
  toErrorCode,
  toPolicy,
} from './types';

/**
 * Fetch the policy for a workspace + mission type.
 * Returns success(null) when no row exists (caller decides the fallback).
 */
export async function getMissionTypePolicy(
  workspaceId: string,
  missionType: string,
): Promise<Result<MissionTypePolicy | null, PolicyRepoError>> {
  try {
    const d1 = createServerClient();
    const row = await d1
      .prepare(
        'SELECT id, workspace_id, mission_type, autonomy_tier, require_publish_approval, ' +
        'max_cost_cents_per_run, max_auto_retries, created_at, updated_at ' +
        'FROM mission_type_policies WHERE workspace_id = ?1 AND mission_type = ?2',
      )
      .bind(workspaceId, missionType)
      .first<PolicyRow>();

    return success(row ? toPolicy(row) : null);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[PolicyRepo] getMissionTypePolicy failed', { error: message, workspaceId, missionType });
    return failure({ code, message });
  }
}

/**
 * List all policies for a workspace, ordered by mission type.
 */
export async function listMissionTypePolicies(
  workspaceId: string,
): Promise<Result<MissionTypePolicy[], PolicyRepoError>> {
  try {
    const d1 = createServerClient();
    const res = await d1
      .prepare(
        'SELECT id, workspace_id, mission_type, autonomy_tier, require_publish_approval, ' +
        'max_cost_cents_per_run, max_auto_retries, created_at, updated_at ' +
        'FROM mission_type_policies WHERE workspace_id = ?1 ORDER BY mission_type ASC',
      )
      .bind(workspaceId)
      .all<PolicyRow>();

    return success((res.results ?? []).map(toPolicy));
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[PolicyRepo] listMissionTypePolicies failed', { error: message, workspaceId });
    return failure({ code, message });
  }
}
