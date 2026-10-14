/**
 * Autonomy Policy Write Operations
 *
 * Layer: tree/autonomy
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { MissionTypePolicy } from '@/seed/types/production-factory';
import {
  type PolicyRepoError,
  type MissionTypePolicyInput,
  toErrorCode,
  validateInput,
} from './types';
import { getMissionTypePolicy } from './read-ops';

/**
 * Upsert a policy for a workspace + mission type.
 * Preserves created_at on conflict via ON CONFLICT DO UPDATE.
 */
export async function setMissionTypePolicy(
  workspaceId: string,
  missionType: string,
  input: MissionTypePolicyInput,
): Promise<Result<MissionTypePolicy, PolicyRepoError>> {
  try {
    const validationError = validateInput(input);
    if (validationError) {
      return failure({ code: 'VALIDATION_ERROR', message: validationError });
    }

    const d1 = createServerClient();
    const id = `${workspaceId}:${missionType}`;
    const nowMs = Date.now();

    await d1
      .prepare(
        'INSERT INTO mission_type_policies ' +
        '(id, workspace_id, mission_type, autonomy_tier, require_publish_approval, ' +
        'max_cost_cents_per_run, max_auto_retries, created_at, updated_at) ' +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ' +
        'ON CONFLICT(workspace_id, mission_type) DO UPDATE SET ' +
        'autonomy_tier = excluded.autonomy_tier, ' +
        'require_publish_approval = excluded.require_publish_approval, ' +
        'max_cost_cents_per_run = excluded.max_cost_cents_per_run, ' +
        'max_auto_retries = excluded.max_auto_retries, ' +
        'updated_at = excluded.updated_at',
      )
      .bind(
        id,
        workspaceId,
        missionType,
        input.autonomyTier,
        input.requirePublishApproval ? 1 : 0,
        input.maxCostCentsPerRun,
        input.maxAutoRetries,
        nowMs,
        nowMs,
      )
      .run();

    // Read back the canonical row so created_at survives an upsert.
    const stored = await getMissionTypePolicy(workspaceId, missionType);
    if (!stored.ok) return failure(stored.error);
    if (!stored.value) {
      return failure({ code: 'DB_ERROR', message: 'Policy write did not persist' });
    }
    return success(stored.value);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[PolicyRepo] setMissionTypePolicy failed', { error: message, workspaceId, missionType });
    return failure({ code, message });
  }
}

/**
 * Delete the policy for a workspace + mission type. No-op when absent.
 */
export async function deleteMissionTypePolicy(
  workspaceId: string,
  missionType: string,
): Promise<Result<void, PolicyRepoError>> {
  try {
    const d1 = createServerClient();
    await d1
      .prepare('DELETE FROM mission_type_policies WHERE workspace_id = ?1 AND mission_type = ?2')
      .bind(workspaceId, missionType)
      .run();
    return success(undefined);
  } catch (err) {
    const { code, message } = toErrorCode(err);
    logger.error('[PolicyRepo] deleteMissionTypePolicy failed', { error: message, workspaceId, missionType });
    return failure({ code, message });
  }
}
