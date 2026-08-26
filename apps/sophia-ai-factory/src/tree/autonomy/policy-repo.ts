/**
 * Mission-Type Policy Repository
 *
 * Persistence for per-mission-type autonomy policies backed by the
 * `mission_type_policies` table (migration 0257). Uses the synchronous
 * `createServerClient()` accessor — never awaited — matching the canonical
 * D1 access pattern.
 *
 * Layer: tree (domain-specific reusable).
 *
 * @module tree/autonomy/policy-repo
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { AutonomyTier, MissionTypePolicy } from '@/seed/types/production-factory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PolicyRepoError =
  | { code: 'DB_UNAVAILABLE'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'DB_ERROR'; message: string };

/** Writable fields for upserting a mission-type policy. */
export interface MissionTypePolicyInput {
  autonomyTier: AutonomyTier;
  requirePublishApproval: boolean;
  /** Budget cap in INTEGER cents; null = no cap. */
  maxCostCentsPerRun: number | null;
  maxAutoRetries: number;
}

/** Raw snake_case row shape returned by D1. */
interface PolicyRow {
  id: string;
  workspace_id: string;
  mission_type: string;
  autonomy_tier: number;
  require_publish_approval: number;
  max_cost_cents_per_run: number | null;
  max_auto_retries: number;
  created_at: number;
  updated_at: number;
}

const DEFAULT_MAX_AUTO_RETRIES = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toErrorCode(err: unknown): { code: PolicyRepoError['code']; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('not available') || message.includes('binding')) {
    return { code: 'DB_UNAVAILABLE', message };
  }
  return { code: 'DB_ERROR', message };
}

function toPolicy(row: PolicyRow): MissionTypePolicy {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    missionType: row.mission_type,
    autonomyTier: row.autonomy_tier as AutonomyTier,
    requirePublishApproval: row.require_publish_approval === 1,
    maxCostCentsPerRun: row.max_cost_cents_per_run,
    maxAutoRetries: row.max_auto_retries,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateInput(input: MissionTypePolicyInput): string | null {
  if (!Number.isInteger(input.autonomyTier) || input.autonomyTier < 0 || input.autonomyTier > 3) {
    return `Invalid autonomy tier: ${input.autonomyTier}. Must be an integer 0-3.`;
  }
  if (!Number.isInteger(input.maxAutoRetries) || input.maxAutoRetries < 0) {
    return `Invalid max auto retries: ${input.maxAutoRetries}. Must be a non-negative integer.`;
  }
  if (
    input.maxCostCentsPerRun !== null &&
    (!Number.isInteger(input.maxCostCentsPerRun) || input.maxCostCentsPerRun < 0)
  ) {
    return `Invalid budget cap: ${input.maxCostCentsPerRun}. Must be null or a non-negative integer (cents).`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

export { DEFAULT_MAX_AUTO_RETRIES };
